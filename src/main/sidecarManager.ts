import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { appendFile } from 'fs/promises'
import * as net from 'net'

export type SidecarStatus = 'starting' | 'healthy' | 'unhealthy' | 'stopped'

let sidecarProcess: ChildProcess | null = null
let restartCount = 0
const MAX_RESTARTS = 3
let currentStatus: SidecarStatus = 'stopped'
let healthCheckTimer: NodeJS.Timeout | null = null
let consecutiveFailures = 0
let sidecarPort = 8000

const LOG_DIR = join(app.getPath('userData'), 'logs')
const LOG_FILE = join(LOG_DIR, 'sidecar.log')

async function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(findFreePort(startPort + 1)))
    server.listen(startPort, '127.0.0.1', () => {
      server.close(() => resolve(startPort))
    })
  })
}

export function getSidecarPort(): number {
  return sidecarPort
}

function setStatus(status: SidecarStatus): void {
  currentStatus = status
  setTimeout(() => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('sidecar-status-changed', status)
      }
    })
  }, 500)
}

async function writeLog(message: string): Promise<void> {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    const timestamp = new Date().toISOString()
    await appendFile(LOG_FILE, `[${timestamp}] ${message}\n`)
  } catch (err) {
    console.error('Failed to write sidecar log:', err)
  }
}

async function checkHealth(): Promise<void> {
  if (currentStatus === 'stopped') return
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`http://127.0.0.1:${sidecarPort}/health`, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (response.ok) {
      if (currentStatus !== 'healthy') {
        console.log(`[Sidecar] Engine started successfully on port ${sidecarPort}.`)
        await writeLog(`Engine started successfully on port ${sidecarPort}.`)
        restartCount = 0 // 🎉 [Fix] 啟動成功，重置重啟計數器
      }
      consecutiveFailures = 0
      setStatus('healthy')
    } else throw new Error(`Status: ${response.status}`)
  } catch (err) {
    consecutiveFailures++
    if (currentStatus !== 'starting' || consecutiveFailures > 6) {
      if (consecutiveFailures % 10 === 1) {
        console.warn(`[Sidecar] Health check failed (${consecutiveFailures})`)
      }
    }
    // 🟡 [Important] 縮短判定時間至 1 分鐘 (12 * 5s)
    if (consecutiveFailures >= 12) {
      console.error('Sidecar unresponsive, restarting...')
      writeLog('Sidecar unresponsive, triggered auto-restart.')
      stopSidecar()
      setStatus('starting')
      setTimeout(startSidecar, 2000)
    }
  }
}

export async function startSidecar(): Promise<void> {
  if (sidecarProcess) return
  setStatus('starting')
  
  sidecarPort = await findFreePort(8000)
  
  let pythonExecutable = ''
  let args: string[] = []

  if (is.dev) {
    // 開發環境：執行 python 腳本
    const sidecarPath = join(__dirname, '../../sidecar/main.py')
    const venvPath = join(__dirname, '../../venv/Scripts/python.exe')
    pythonExecutable = existsSync(venvPath) ? venvPath : (process.platform === 'win32' ? 'python' : 'python3')
    args = [sidecarPath, '--port', sidecarPort.toString()]
  } else {
    // 生產環境：執行打包好的執行檔 (VoxNoteSidecar.exe)
    // 預設路徑：resources/sidecar/VoxNoteSidecar.exe
    pythonExecutable = join(process.resourcesPath, 'sidecar', 'VoxNoteSidecar.exe')
    args = ['--port', sidecarPort.toString()]
    
    if (!existsSync(pythonExecutable)) {
      // 備選路徑
      const altPath = join(process.resourcesPath, 'sidecar', 'VoxNoteSidecar', 'VoxNoteSidecar.exe')
      if (existsSync(altPath)) pythonExecutable = altPath
    }
  }

  console.log(`Starting sidecar on port ${sidecarPort}: ${pythonExecutable} ${args.join(' ')}`)
  writeLog(`Starting sidecar process: ${pythonExecutable}`)

  if (!existsSync(pythonExecutable) && !is.dev) {
    writeLog(`CRITICAL ERROR: Sidecar executable not found at ${pythonExecutable}`)
    setStatus('unhealthy')
    return
  }

  sidecarProcess = spawn(pythonExecutable, args, {
    windowsHide: true,
    env: { 
      ...process.env, 
      KMP_DUPLICATE_LIB_OK: 'TRUE',
      OMP_NUM_THREADS: '1',
      MKL_NUM_THREADS: '1',
      PYTORCH_CUDA_ALLOC_CONF: 'expandable_segments:True'
    }
  })

  sidecarProcess.stdout?.on('data', (d) => writeLog(`[STDOUT] ${d.toString().trim()}`))
  sidecarProcess.stderr?.on('data', (d) => writeLog(`[STDERR] ${d.toString().trim()}`))
  sidecarProcess.on('error', (err) => {
    writeLog(`CRITICAL ERROR: ${err.message}`)
    setStatus('unhealthy')
  })

  sidecarProcess.on('exit', (code) => {
    console.log(`Sidecar exited (code: ${code})`)
    sidecarProcess = null
    if (currentStatus !== 'stopped' && restartCount < MAX_RESTARTS) {
      restartCount++
      setStatus('unhealthy')
      setTimeout(startSidecar, 5000)
    }
  })

  if (!healthCheckTimer) healthCheckTimer = setInterval(checkHealth, 5000)
}

export function stopSidecar(): void {
  if (healthCheckTimer) { clearInterval(healthCheckTimer); healthCheckTimer = null; }
  if (sidecarProcess) {
    const pid = sidecarProcess.pid
    setStatus('stopped')
    if (process.platform === 'win32' && pid) {
      // 🛡️ [Hard Kill] Windows 專用：強制終止整個進程樹 (/T /F)，防止 GPU 殘留
      const { execSync } = require('child_process')
      try {
        execSync(`taskkill /pid ${pid} /f /t`)
      } catch (e) {
        sidecarProcess.kill()
      }
    } else {
      sidecarProcess.kill()
    }
    sidecarProcess = null
  }
}

export function getSidecarStatus(): SidecarStatus { return currentStatus }

app.on('before-quit', () => stopSidecar())
app.on('will-quit', () => stopSidecar())
