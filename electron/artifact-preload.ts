import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('openclawArtifactBridge', {
  invoke: (method: string, params?: unknown) => ipcRenderer.invoke('artifact:bridgeCall', { method, params }),
})
