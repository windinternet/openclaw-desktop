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
  marketplace: {
    search: (params: unknown) => ipcRenderer.invoke('marketplace:search', params),
  },
  storage: {
    loadAppState: () => ipcRenderer.invoke('storage:loadAppState'),
    saveSettings: (settings: unknown) => ipcRenderer.invoke('storage:saveSettings', settings),
    saveInstances: (instances: unknown) => ipcRenderer.invoke('storage:saveInstances', instances),
    saveCurrentInstanceId: (id: string | null) => ipcRenderer.invoke('storage:saveCurrentInstanceId', id),
    removeInstance: (id: string) => ipcRenderer.invoke('storage:removeInstance', id),
    loadInstanceData: (instanceId: string, key: string) =>
      ipcRenderer.invoke('storage:loadInstanceData', instanceId, key),
    saveInstanceData: (instanceId: string, key: string, value: unknown) =>
      ipcRenderer.invoke('storage:saveInstanceData', instanceId, key, value),
  },
  device: {
    signChallenge: (params: { nonce: string; token: string; clientId: string }) =>
      ipcRenderer.invoke('device:signChallenge', params),
  },
  install: {
    run: () => ipcRenderer.invoke('install:openclaw'),
  },
})
