import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  discover: {
    scan: () => ipcRenderer.invoke('discover:scan'),
  },
  config: {
    getUserDataPath: () => ipcRenderer.invoke('config:getPath'),
  },
})
