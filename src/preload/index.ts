import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data: any) => ipcRenderer.send(channel, data),
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (_event: any, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    },
    off: (channel: string, func: (...args: any[]) => void) => ipcRenderer.removeListener(channel, func),
    invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
  }
})
