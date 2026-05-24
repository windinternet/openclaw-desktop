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
  notifications: {
    show: (params: { title: string; body: string }) => ipcRenderer.invoke('notification:show', params),
  },
  device: {
    signChallenge: (params: { nonce: string; token: string; clientId: string }) =>
      ipcRenderer.invoke('device:signChallenge', params),
  },
  install: {
    run: () => ipcRenderer.invoke('install:openclaw'),
  },
})
