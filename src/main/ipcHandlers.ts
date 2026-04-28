import { ipcMain, app, dialog, BrowserWindow, safeStorage } from 'electron'
import { writeFile, readFile, mkdir, copyFile, unlink } from 'fs/promises'
import { join, resolve, normalize } from 'path'
import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync, appendFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { getSidecarPort, getSidecarStatus } from './sidecarManager'

// 🛡️ [Production Ready] 路徑定義
const USER_DATA_PATH = app.getPath('userData')
const LOG_DIR = join(USER_DATA_PATH, 'logs')
const MAIN_LOG = join(LOG_DIR, 'main.log')
const DB_DIR = join(USER_DATA_PATH, 'database')
const CONFIG_PATH = join(USER_DATA_PATH, 'config.json')

// 🟢 [Fix] 開發環境優先使用專案內 DB，生產環境才使用 AppData
const DB_FILE_PATH = is.dev
  ? join(app.getAppPath(), 'prisma', 'dev.db')
  : join(DB_DIR, 'meetings.db')

// 🛡️ [Production Logger]
function logMain(msg: string) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(MAIN_LOG, `[${new Date().toISOString()}] ${msg}\n`)
  } catch (e) { console.error('Failed to write main log:', e) }
}

/**
 * 🛡️ [Database Initializer] 一勞永逸修正版
 * 確保在建立 PrismaClient 前完成環境與模板準備
 */
function initializeDatabase() {
  logMain(`[Prisma] Initializing database strategy. Mode: ${is.dev ? 'Dev' : 'Prod'}, Target: ${DB_FILE_PATH}`)
  
  if (!is.dev && !existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true })
    logMain(`[Prisma] Created database directory: ${DB_DIR}`)
  }

  // 判定是否需要初始化：檔案不存在 或 檔案大小為 0 (或極小)
  let needInit = false
  if (!existsSync(DB_FILE_PATH)) {
    needInit = true
    logMain(`[Prisma] DB file missing at ${DB_FILE_PATH}.`)
  } else if (statSync(DB_FILE_PATH).size < 4096) {
    needInit = true
    logMain(`[Prisma] DB file is invalid/empty (${statSync(DB_FILE_PATH).size} bytes).`)
  }

  if (needInit) {
    // 優先搜尋可能的模板來源 (包含開發與生產環境)
    const possibleTemplates = [
      join(app.getAppPath(), 'prisma', 'template_meetings.db'),
      join(process.resourcesPath, 'prisma', 'template_meetings.db'),
      join(process.resourcesPath, 'app.asar.unpacked', 'prisma', 'template_meetings.db')
    ]
    
    let success = false
    for (const tPath of possibleTemplates) {
      if (existsSync(tPath) && tPath !== DB_FILE_PATH) {
        try {
          copyFileSync(tPath, DB_FILE_PATH)
          logMain(`[Prisma] SUCCESS: Copied template from ${tPath} to ${DB_FILE_PATH}`)
          success = true
          break
        } catch (err: any) {
          logMain(`[Prisma] ERROR: Failed to copy template: ${err.message}`)
        }
      }
    }

    if (!success && is.dev) {
      logMain(`[Prisma] Dev Warning: No template found. Please run 'npx prisma db push' to initialize schema.`)
    } else if (!success) {
      logMain(`[Prisma] CRITICAL: No valid template found in Prod!`)
    }
  }

  // 🟢 [Fix] 若外部已正確設定 DATABASE_URL (如 .env)，且指向現有 DB，則不覆蓋
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(DB_FILE_PATH)) {
    logMain(`[Prisma] DATABASE_URL already set and matches target. Skipping override.`)
  } else {
    process.env.DATABASE_URL = `file:${DB_FILE_PATH}`
    logMain(`[Prisma] DATABASE_URL set to: ${process.env.DATABASE_URL}`)
  }
}

// 1. 先跑初始化
initializeDatabase()

// 2. [Crucial] 初始化完成後才建立 Prisma 實例
const prisma = new PrismaClient()

/**
 * 🛡️ [Security] 路徑安全驗證
 */
async function isPathSafe(inputPath: string): Promise<boolean> {
  if (!inputPath) return false;
  if (inputPath.startsWith('http://') || inputPath.startsWith('https://')) return true;
  if (inputPath === 'text_import') return true;

  try {
    const config = await getConfig();
    const safeRoots = [
      app.getPath('userData'), app.getPath('temp'), app.getPath('desktop'), app.getPath('documents'), config.recordingsPath
    ].filter(Boolean).map(p => resolve(p).toLowerCase());
    const resolvedInput = resolve(inputPath).toLowerCase();
    return safeRoots.some(root => resolvedInput.startsWith(root));
  } catch (err) { return false; }
}

function formatTime(sec?: number) {
  const s = Math.max(0, Math.floor(sec ?? 0))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function escapeHtml(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function groupTranscriptSegments(segments: any[], opts?: { pauseSec?: number; maxChars?: number; minChars?: number }) {
  const pauseSec = opts?.pauseSec ?? 1.0;
  const maxChars = opts?.maxChars ?? 300;
  const minChars = opts?.minChars ?? 40;
  const sorted = [...segments].sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
  const groups: any[] = []

  for (const s of sorted) {
    const speakerName = s.speaker?.displayName || '未知'
    const text = (s.content || '').toString().trim()
    if (!text) continue
    const st = Number(s.startTime ?? 0), et = Number(s.endTime ?? st)
    const last = groups[groups.length - 1]
    if (!last || last.speakerName !== speakerName || (st - last.endTime) >= pauseSec || last.texts.join('').length > maxChars) {
      groups.push({ speakerName, speakerId: s.speaker?.id, startTime: st, endTime: et, texts: [text] })
    } else {
      last.texts.push(text)
      last.endTime = Math.max(last.endTime, et)
    }
  }
  return groups
}

async function getConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return {
      modelSize: 'base', device: 'cpu', hfToken: '',
      recordingsPath: join(app.getPath('userData'), 'recordings'),
      isCollaborative: true, logicModelPath: '', polishModelPath: '',
      customTerms: '', llmDevice: 'cpu'
    }
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}

export function setupIpcHandlers() {
  ipcMain.handle('get-config', async () => getConfig())
  ipcMain.handle('save-config', async (_, config) => {
    if (config.hfToken && safeStorage.isEncryptionAvailable()) {
      try { config.hfToken = safeStorage.encryptString(config.hfToken).toString('base64'); } catch (e) { }
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    return { success: true }
  })

  ipcMain.handle('select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('select-llm-model', async (_, title: string) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ title, filters: [{ name: 'GGUF Models', extensions: ['gguf'] }], properties: ['openFile'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('select-media-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Media Files', extensions: ['mp3', 'wav', 'mp4', 'm4a', 'mov'] }], properties: ['openFile'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('select-text-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Text/Documents', extensions: ['txt', 'pdf', 'docx'] }], properties: ['openFile'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('register-external-file', async (_, { filePath, title }: { filePath: string, title: string }) => {
    try {
      if (!(await isPathSafe(filePath))) throw new Error(`[Security Alert] 拒絕存取未授權路徑：${filePath}`);
      const meeting = await prisma.meeting.create({ data: { title, date: new Date(), audioPath: filePath, status: 'pending' } })
      return { success: true, meetingId: meeting.id }
    } catch (err) { return { success: false, error: (err as Error).message } }
  })

  const activeProcessingJobs = new Map<string, { jobId: string, meetingId: string }>();

  ipcMain.handle('cancel-processing', async (_, { meetingId }: { meetingId: string }) => {
    const jobInfo = activeProcessingJobs.get(meetingId);
    if (!jobInfo) return { success: false, message: '查無執行中的任務' };
    try {
      const res = await fetch(`http://localhost:${getSidecarPort()}/cancel_job/${jobInfo.jobId}`, { method: 'POST' });
      const data = await res.json();
      return { success: data.status === 'cancelling', message: data.message };
    } catch (err) { return { success: false, message: '發送取消請求失敗' }; }
  });

  ipcMain.handle('force-reset-engine', async () => {
    const { startSidecar, stopSidecar } = require('./sidecarManager');
    stopSidecar();
    setTimeout(() => startSidecar(), 2000);
    return { success: true };
  });

  function normalizeProgress(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'string') v = v.trim().replace('%', '');
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (n > 0 && n < 1) return Math.round(n * 100);
    if (n >= 1 && n <= 100) return Math.round(n);
    return 0;
  }

  ipcMain.handle('process-meeting', async (_, { meetingId, audioPath, tasks, summaryMode }: { meetingId: string, audioPath: string, tasks?: string[], summaryMode?: string }) => {
    try {
      if (!(await isPathSafe(audioPath))) throw new Error(`[Security Alert] 拒絕存取未授權路徑：${audioPath}`);
      const config = await getConfig()
      const runStt = !tasks || tasks.includes('stt'), runLlm = !tasks || tasks.includes('llm')
      let initialPrompt = runStt && config.customTerms ? `這是一段專業的繁體中文商務會議紀錄。請精確識別以下專業術語：${config.customTerms}。` : ""

      const response = await fetch(`http://localhost:${getSidecarPort()}/process_meeting`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audio_path: audioPath, language: 'zh', model_size: config.modelSize, device: config.device, llm_device: config.llmDevice || config.device,
          run_stt: runStt, run_diarization: false, hf_token: config.hfToken, run_llm: runLlm,
          logic_model_path: config.logicModelPath, polish_model_path: config.polishModelPath,
          summary_mode: summaryMode || 'auto', text_content: '', initial_prompt: initialPrompt
        })
      })
      
      const { job_id } = await response.json();
      activeProcessingJobs.set(meetingId, { jobId: job_id, meetingId });

      let completed = false, result = null, isCancelled = false;
      while (!completed) {
        await new Promise(r => setTimeout(r, 3000))
        const statusRes = await fetch(`http://localhost:${getSidecarPort()}/job/${job_id}`);
        const statusData = await statusRes.json();
        if (statusData.status === 'completed') { completed = true; result = statusData.result; }
        else if (statusData.status === 'stopped' || statusData.status === 'failed') { completed = true; isCancelled = (statusData.status === 'stopped'); }
        else {
          BrowserWindow.getAllWindows()[0]?.webContents.send('processing-progress', { meetingId, progress: normalizeProgress(statusData.progress), message: statusData.message })
        }
      }

      if (isCancelled || !result) return { success: false, error: '任務中斷' };

      // 🛡️ [Data Integrity Shield]
      const existingCount = await prisma.transcriptSegment.count({ where: { meetingId } });
      if (existingCount > 10 && result.segments.length < existingCount * 0.7) throw new Error('[數據保護] 檢測到分析結果段落數銳減，攔截寫入。');

      await prisma.$transaction(async (tx) => {
        await tx.transcriptSegment.deleteMany({ where: { meetingId } })
        await tx.speaker.deleteMany({ where: { meetingId } })
        const labels = Array.from(new Set(result.segments.map((s: any) => s.speaker || 'SPEAKER_00')))
        await Promise.all(labels.map(l => tx.speaker.create({ data: { meetingId, label: l as string, displayName: l as string } })))
        const speakers = await tx.speaker.findMany({ where: { meetingId } })
        const speakerMap = new Map(speakers.map(s => [s.label, s.id]))
        for (const seg of result.segments) {
          await tx.transcriptSegment.create({
            data: { meetingId, speakerId: speakerMap.get(seg.speaker) || speakers[0]?.id as string, startTime: seg.start || 0, endTime: seg.end || 0, content: seg.text }
          })
        }
        if (result.summary) {
          await tx.summary.upsert({ where: { meetingId }, create: { meetingId, highlights: JSON.stringify(result.summary) }, update: { highlights: JSON.stringify(result.summary) } })
        }
        await tx.meeting.update({ where: { id: meetingId }, data: { status: 'completed', date: new Date() } })
      })
      return { success: true }
    } catch (err) { return { success: false, error: (err as Error).message } }
    finally { activeProcessingJobs.delete(meetingId); }
  })

  ipcMain.handle('get-meetings', async (_, { search } = {}) => {
    if (search) {
      return prisma.meeting.findMany({
        where: {
          OR: [
            { title: { contains: search } },
            { audioPath: { contains: search } }
          ]
        },
        orderBy: { date: 'desc' }
      })
    }
    return prisma.meeting.findMany({ orderBy: { date: 'desc' } })
  })

  ipcMain.handle('save-audio', async (_, { buffer, title }) => {
    try {
      const config = await getConfig()
      const recordingsPath = config.recordingsPath || join(app.getPath('userData'), 'recordings')
      if (!existsSync(recordingsPath)) mkdirSync(recordingsPath, { recursive: true })
      
      const fileName = `record_${Date.now()}.wav`
      const filePath = join(recordingsPath, fileName)
      
      await writeFile(filePath, Buffer.from(buffer))
      
      const meeting = await prisma.meeting.create({
        data: {
          title,
          date: new Date(),
          audioPath: filePath,
          status: 'pending'
        }
      })
      
      return { success: true, meetingId: meeting.id, audioPath: filePath }
    } catch (err: any) {
      logMain(`[save-audio] Error: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('export-meeting', async (_, { meetingId, type, title, segments, summary }: any) => {
    try {
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') + "_" +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0');
      
      const fileSuffix = type.includes('analysis') ? '專家報告' : '逐字稿';
      const defaultFileName = `${timestamp}${fileSuffix}.pdf`;

      const { filePath } = await dialog.showSaveDialog({
        title: `匯出${fileSuffix}`,
        defaultPath: join(app.getPath('desktop'), defaultFileName),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (!filePath) return { success: false, error: 'User canceled' }

      const win = new BrowserWindow({ show: false })
      let html = ''

      if (type === 'pdf-transcript') {
        html = `
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
            .segment { margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
            .time { color: #64748b; font-size: 11px; font-weight: bold; margin-right: 10px; }
            .speaker { font-weight: 900; color: #1e40af; margin-right: 8px; text-transform: uppercase; font-size: 12px; }
            .content { font-size: 14px; }
          </style>
          <h1>會議逐字稿：${title}</h1>
          <p style="color: #64748b; font-size: 12px;">匯出日期：${new Date().toLocaleString()}</p>
          ${segments.map((s: any) => `
            <div class="segment">
              <span class="time">[${Math.floor(s.startTime / 60)}:${Math.floor(s.startTime % 60).toString().padStart(2, '0')}]</span>
              <span class="speaker">${s.speaker?.displayName || '未知'}:</span>
              <span class="content">${s.content}</span>
            </div>
          `).join('')}
        `
      } else {
        html = `
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .card { border: 1px dotted #cbd5e1; padding: 20px; border-radius: 15px; margin-bottom: 20px; background: #f8fafc; }
            h1 { color: #b45309; text-align: center; border-bottom: 4px double #b45309; padding-bottom: 15px; }
            h3 { color: #92400e; border-left: 5px solid #f59e0b; padding-left: 12px; margin-top: 25px; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; font-size: 14px; }
            .basic-grid { display: grid; grid-cols: 3; gap: 10px; }
          </style>
          <h1>AI 專家分析報告：${title}</h1>
          
          <div class="card">
            <h3>01 / 基本資訊</h3>
            <p><b>主題：</b>${summary?.basic_info?.subject || 'N/A'}</p>
            <p><b>與會人員：</b>${summary?.basic_info?.participants || 'N/A'}</p>
            <p><b>時間：</b>${summary?.basic_info?.time || 'N/A'}</p>
          </div>

          <h3>02 / 會議議程</h3>
          <ul>${summary?.agenda?.map((a: string) => `<li>${a}</li>`).join('') || '<li>未明確形成</li>'}</ul>

          <h3>03 / 核心討論內容</h3>
          <ul>${summary?.key_content?.map((k: string) => `<li>${k}</li>`).join('') || '<li>未明確形成</li>'}</ul>

          <h3>04 / 決議紀錄</h3>
          <ul>${summary?.decisions?.map((d: string) => `<li><b>[✔]</b> ${d}</li>`).join('') || '<li>未明確形成</li>'}</ul>

          <h3>05 / 待辦事項</h3>
          <ul>${summary?.action_items?.map((a: string) => `<li><b>[ ]</b> ${a}</li>`).join('') || '<li>未明確形成</li>'}</ul>

          <div class="card" style="margin-top: 30px; border: none; background: #fffbeb;">
            <h3>06 / 深度討論摘要</h3>
            <p><b>追蹤類：</b>${summary?.discussion?.tracking?.join('、') || '無'}</p>
            <p><b>亮點：</b>${summary?.discussion?.interesting?.join('、') || '無'}</p>
            <p><b>回溯類：</b>${summary?.discussion?.retrospective?.join('、') || '無'}</p>
          </div>
          
          <p style="text-align: center; font-size: 10px; color: #94a3b8; margin-top: 50px;">Generated by VoxNote AI - Professional Intelligence Report</p>
        `
      }

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<html><head><meta charset="UTF-8"></head><body>'+html+'</body></html>')}`)
      const pdfData = await win.webContents.printToPDF({ printBackground: true })
      await writeFile(filePath, pdfData)
      win.close()
      return { success: true, path: filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // --- Action Items Handlers ---
  ipcMain.handle('get-all-action-items', async () => {
    return prisma.actionItem.findMany({
      include: { meeting: { select: { title: true, date: true } } },
      orderBy: { createdAt: 'desc' }
    })
  })

  ipcMain.handle('toggle-action-status', async (_, { actionId, status }) => {
    try {
      await prisma.actionItem.update({
        where: { id: actionId },
        data: { status }
      })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('update-action-priority', async (_, { actionId, priority }) => {
    try {
      await prisma.actionItem.update({
        where: { id: actionId },
        data: { priority }
      })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('delete-action-item', async (_, id) => {
    try {
      await prisma.actionItem.delete({ where: { id } })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('get-meeting-details', async (_, id) => prisma.meeting.findUnique({ where: { id }, include: { segments: { include: { speaker: true } }, summary: true, actionItems: true } }))
  ipcMain.handle('delete-meeting', async (_, id) => { await prisma.meeting.delete({ where: { id } }); return { success: true } })
  ipcMain.handle('get-sidecar-status', async () => getSidecarStatus())
}
