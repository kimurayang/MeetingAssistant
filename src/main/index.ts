import { app, BrowserWindow, ipcMain, desktopCapturer, protocol, net, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { startSidecar } from './sidecarManager'
import { setupIpcHandlers } from './ipcHandlers'
import { pathToFileURL } from 'url'

// 1. 關鍵修復：註冊 media 為特權協定，但不繞過 CSP (安全性考量)
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'media', 
    privileges: { 
      standard: true, 
      secure: true, 
      supportFetchAPI: true, 
      stream: true, 
      bypassCSP: false // 🛡️ [Security] 不再繞過 CSP，改為在 CSP 中明確授權
    } 
  }
])

// 註冊自定義協定以載入本地影音
function registerMediaProtocol() {
  protocol.handle('media', (request) => {
    try {
      let filePath = request.url.slice('media://'.length)
      filePath = decodeURIComponent(filePath)
      
      if (process.platform === 'win32' && filePath.startsWith('/') && filePath.includes(':')) {
        filePath = filePath.substring(1)
      }

      // 🛡️ [Security] 副檔名白名單限制
      const allowedExts = ['.wav', '.mp3', '.mp4', '.m4a', '.mov', '.ogg', '.webm'];
      const isAllowed = allowedExts.some(ext => filePath.toLowerCase().endsWith(ext));
      
      if (!isAllowed) {
        console.warn(`[Security Alert] Blocked non-media file access via protocol: ${filePath}`);
        return new Response('Access Denied: Only media files allowed', { status: 403 });
      }

      const fileUrl = pathToFileURL(filePath).toString()
      return net.fetch(fileUrl)
    } catch (error) {
      console.error('Media protocol error:', error)
      return new Response('File not found', { status: 404 })
    }
  })
}

function setupSecurityPolicies() {
  // 🛡️ [Security] 實作嚴格的內容安全政策 (CSP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: media:; " + // 允許 media 協定圖片
          "media-src 'self' media: blob:; " + // 🛡️ 顯式授權 media 協定
          "connect-src 'self' http://127.0.0.1:* ws://localhost:*;" // 允許連接 Sidecar 與 Vite
        ]
      }
    })
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' })
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  setupSecurityPolicies()
  registerMediaProtocol()
  startSidecar()
  setupIpcHandlers()
  electronApp.setAppUserModelId('com.offline-ai-assistant')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
