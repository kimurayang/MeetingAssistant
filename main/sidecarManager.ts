import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { app } from 'electron'
import { existsSync } from 'fs'

let sidecarProcess: ChildProcess | null = null

export function startSidecar(): void {
  // Determine Python Path
  let sidecarPath = is.dev
    ? join(__dirname, '../../sidecar/main.py')
    : join(process.resourcesPath, 'sidecar/main.py')

  // Support for development in virtualenv if it exists
  const venvPath = is.dev 
    ? join(__dirname, '../../venv/Scripts/python.exe') 
    : ''
    
  let pythonExecutable = 'python'
  if (is.dev && existsSync(venvPath)) {
    pythonExecutable = venvPath
    console.log(`Using venv Python: ${pythonExecutable}`)
  } else {
    pythonExecutable = process.platform === 'win32' ? 'python' : 'python3'
  }

  console.log(`Starting sidecar from ${sidecarPath} with ${pythonExecutable}`)

  // Start the process
  sidecarProcess = spawn(pythonExecutable, [sidecarPath], {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  })

  sidecarProcess.on('error', (err) => {
    console.error('CRITICAL: Failed to start sidecar process:', err)
  })

  sidecarProcess.on('exit', (code, signal) => {
    console.log(`Sidecar exited with code ${code} and signal ${signal}`)
    // Auto-restart logic could go here if needed
  })
}

export function stopSidecar(): void {
  if (sidecarProcess) {
    console.log('Stopping Sidecar...')
    sidecarProcess.kill()
    sidecarProcess = null
  }
}

app.on('will-quit', () => {
  stopSidecar()
})
