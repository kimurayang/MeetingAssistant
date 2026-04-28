import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { existsSync, readFileSync } from 'fs'

const prisma = new PrismaClient()

function getRecordingsPath() {
  const configPath = join(app.getPath('userData'), 'config.json')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      if (config.recordingsPath && existsSync(config.recordingsPath)) {
        return join(config.recordingsPath, 'recordings')
      }
    } catch (e) { console.error('Failed to parse config:', e) }
  }
  return join(app.getPath('userData'), 'recordings')
}

export function setupIpcHandlers() {
  // 1. 儲存音訊並建立會議記錄
  ipcMain.handle('save-audio', async (_, { buffer, title }: { buffer: ArrayBuffer | Buffer, title: string }) => {
    try {
      const audioDir = getRecordingsPath()
      await mkdir(audioDir, { recursive: true })
      
      const fileName = `${Date.now()}.wav`
      const filePath = join(audioDir, fileName)
      
      await writeFile(filePath, Buffer.from(buffer))
      
      const meeting = await prisma.meeting.create({
        data: {
          title,
          audioPath: filePath,
          status: 'pending'
        }
      })
      
      return { success: true, meetingId: meeting.id, filePath }
    } catch (err) {
      console.error('Failed to save audio:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // 2. 取得會議列表
  ipcMain.handle('get-meetings', async () => {
    return await prisma.meeting.findMany({
      orderBy: { date: 'desc' }
    })
  })

  // 3. 取得單一會議詳情
  ipcMain.handle('get-meeting-details', async (_, meetingId: string) => {
    return await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        segments: {
          include: { speaker: true },
          orderBy: { startTime: 'asc' }
        },
        summary: true,
        speakers: true
      }
    })
  })

  // 4. 呼叫 AI Sidecar 進行處理 (支援 GPU 與雙模型)
  ipcMain.handle('process-meeting', async (_, { meetingId, audioPath, tasks, summaryMode, device }: any) => {
    try {
      console.log(`[IPC] Processing meeting ${meetingId} on ${device || 'cpu'}...`)
      
      // 讀取設定檔取得模型路徑
      const configPath = join(app.getPath('userData'), 'config.json')
      let config: any = {}
      if (existsSync(configPath)) config = JSON.parse(readFileSync(configPath, 'utf-8'))

      const payload = {
        audio_path: audioPath,
        language: 'zh',
        model_size: config.sttModel || 'base',
        device: device || 'cpu',
        run_stt: tasks.includes('stt'),
        run_llm: tasks.includes('llm'),
        logic_model_path: config.logicModelPath || '',
        polish_model_path: config.polishModelPath || '',
        summary_mode: summaryMode || 'auto'
      }

      const response = await fetch('http://127.0.0.1:8000/process_meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error(`Sidecar Error: ${response.status}`)
      const { job_id } = await response.json()

      // 輪詢狀態
      let completed = false
      let finalResult = null
      while (!completed) {
        await new Promise(r => setTimeout(r, 2000))
        const statusRes = await fetch(`http://127.0.0.1:8000/job/${job_id}`)
        const status = await statusRes.json()
        
        // 轉發進度給前端
        const win = BrowserWindow.getAllWindows()[0]
        if (win) win.webContents.send('processing-progress', { meetingId, progress: status.progress, message: status.message })

        if (status.status === 'completed') {
          completed = true
          finalResult = status.result
        } else if (status.status === 'failed') {
          throw new Error(status.message)
        }
      }

      // 儲存結果到資料庫
      if (finalResult) {
        await prisma.$transaction(async (tx) => {
          // 清除舊資料 (若是重新分析)
          if (tasks.includes('stt')) await tx.transcriptSegment.deleteMany({ where: { meetingId } })
          if (tasks.includes('llm')) await tx.summary.deleteMany({ where: { meetingId } })

          // 存入逐字稿
          if (finalResult.segments) {
            const uniqueLabels = Array.from(new Set(finalResult.segments.map((s: any) => s.speaker || 'A')))
            for (const label of uniqueLabels) {
              await tx.speaker.upsert({
                where: { meetingId_label: { meetingId, label: label as string } },
                update: {},
                create: { meetingId, label: label as string, displayName: label as string }
              })
            }
            const speakers = await tx.speaker.findMany({ where: { meetingId } })
            const speakerMap = new Map(speakers.map(s => [s.label, s.id]))

            for (const seg of finalResult.segments) {
              await tx.transcriptSegment.create({
                data: {
                  meetingId,
                  speakerId: speakerMap.get(seg.speaker || 'A'),
                  startTime: seg.start,
                  endTime: seg.end,
                  content: seg.text
                }
              })
            }
          }

          // 存入五段式摘要
          if (finalResult.summary) {
            await tx.summary.create({
              data: {
                meetingId,
                overview: finalResult.summary.basic_info?.subject || '會議摘要',
                highlights: JSON.stringify(finalResult.summary), // 存入完整 JSON
                decisions: JSON.stringify(finalResult.summary.decisions || []),
                actionItems: JSON.stringify(finalResult.summary.action_items || [])
              }
            })
          }

          await tx.meeting.update({ where: { id: meetingId }, data: { status: 'completed' } })
        })
      }

      return { success: true }
    } catch (err) {
      console.error('[IPC] AI processing failed:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // 7. 匯出會議紀錄 (支援五段式專家報告)
  ipcMain.handle('export-meeting', async (_, { meetingId, type, title, segments, summary }: any) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: `匯出${type.includes('analysis') ? '專家報告' : '逐字稿'}`,
        defaultPath: join(app.getPath('desktop'), `${title}_${type}.pdf`),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (!filePath) return { success: false }

      const win = new BrowserWindow({ show: false })
      let html = ''
      
      if (type === 'pdf-transcript') {
        html = `<h1>逐字稿：${title}</h1>` + segments.map((s:any)=>`<p><b>[${Math.floor(s.startTime/60)}:${Math.floor(s.startTime%60).toString().padStart(2,'0')}] ${s.speaker?.displayName}:</b> ${s.content}</p>`).join('')
      } else {
        // 專家報告樣式
        html = `
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .card { border: 1px solid #eee; padding: 20px; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            h1 { color: #2563eb; }
            h3 { color: #1e40af; border-bottom: 2px solid #eef2ff; padding-bottom: 8px; }
            .tag { display: inline-block; padding: 2px 10px; border-radius: 5px; background: #f1f5f9; font-size: 12px; margin-right: 10px; }
          </style>
          <h1>專家分析報告：${title}</h1>
          <div class="card">
            <h3>1. 基本資料</h3>
            <p>主題：${summary?.basic_info?.subject}</p>
            <p>人員：${summary?.basic_info?.participants}</p>
          </div>
          <div class="card">
            <h3>2. 決議紀錄</h3>
            <ul>${summary?.decisions?.map((d:string)=>`<li>${d}</li>`).join('')}</ul>
          </div>
          <div class="card">
            <h3>3. 待辦事項</h3>
            <ul>${summary?.action_items?.map((a:string)=>`<li><b>[ ]</b> ${a}</li>`).join('')}</ul>
          </div>
          <div class="card">
            <h3>4. 深度討論摘要</h3>
            <p><b>進度追蹤：</b>${summary?.discussion?.tracking?.join('；')}</p>
            <p><b>關鍵亮點：</b>${summary?.discussion?.interesting?.join('；')}</p>
          </div>
        `
      }

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<html><body style="padding:40px">'+html+'</body></html>')}`)
      const pdfData = await win.webContents.printToPDF({})
      await writeFile(filePath, pdfData)
      win.close()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

}

// 輔助函數
function generateMarkdown(meeting: any) {
  let md = `# 會議紀錄：${meeting.title}\n`
  md += `日期：${new Date(meeting.date).toLocaleString()}\n\n`
  if (meeting.summary) {
    md += `## AI 摘要\n\n### 會議總結\n${meeting.summary.overview || ''}\n\n`
    const decisions = JSON.parse(meeting.summary.decisions || '[]')
    if (decisions.length > 0) {
      md += `### 關鍵決策\n`
      decisions.forEach((d: string) => md += `- ${d}\n`)
      md += `\n`
    }
    const actions = JSON.parse(meeting.summary.actionItems || '[]')
    if (actions.length > 0) {
      md += `### 待辦清單\n`
      actions.forEach((a: string) => md += `- [ ] ${a}\n`)
      md += `\n`
    }
  }
  md += `## 逐字稿\n\n`
  meeting.segments.forEach((s: any) => {
    const time = Math.floor(s.startTime / 60).toString().padStart(2, '0') + ':' + 
                 Math.floor(s.startTime % 60).toString().padStart(2, '0')
    md += `**[${time}] ${s.speaker?.displayName || '未知'}**：${s.content}\n\n`
  })
  return md
}

async function generatePDF(meeting: any, outputPath: string) {
  const win = new BrowserWindow({ show: false })
  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }
    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; border-left: 5px solid #2563eb; padding-left: 10px; }
    .meta { color: #666; margin-bottom: 20px; font-size: 0.9em; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; }
    .segment { margin-bottom: 15px; }
    .time { color: #94a3b8; font-family: monospace; font-size: 0.8em; margin-right: 10px; }
    .speaker { font-weight: bold; color: #2563eb; margin-right: 5px; }
    </style></head><body>
    <h1>會議報告：${meeting.title}</h1>
    <div class="meta">日期：${new Date(meeting.date).toLocaleString()}</div>
    <div class="summary-box">
      <h2>AI 會議摘要</h2>
      <p><strong>總結：</strong>${meeting.summary?.overview || ''}</p>
      <p><strong>關鍵決策：</strong></p>
      <ul>${JSON.parse(meeting.summary?.decisions || '[]').map((d: any) => `<li>${d}</li>`).join('')}</ul>
    </div>
    <h2>逐字稿內容</h2>
    ${meeting.segments.map((s: any) => `
      <div class="segment">
        <span class="time">[${Math.floor(s.startTime / 60).toString().padStart(2, '0')}:${Math.floor(s.startTime % 60).toString().padStart(2, '0')}]</span>
        <span class="speaker">${s.speaker?.displayName || '未知'}：</span>
        <span>${s.content}</span>
      </div>
    `).join('')}
    </body></html>`
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const data = await win.webContents.printToPDF({ printBackground: true })
  await writeFile(outputPath, data)
  win.close()
}
