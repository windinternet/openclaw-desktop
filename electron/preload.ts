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
  repository: {
    checkGit: () => ipcRenderer.invoke('repository:checkGit'),
    inspect: (repoPath: string) => ipcRenderer.invoke('repository:inspect', repoPath),
    bootstrap: (repoPath: string) => ipcRenderer.invoke('repository:bootstrap', repoPath),
  },
  artifact: {
    open: (artifactId: string, version: number) => ipcRenderer.invoke('artifact:open', artifactId, version),
    getMeta: (artifactId: string) => ipcRenderer.invoke('artifact:getMeta', artifactId),
    getHtml: (artifactId: string, version?: number) => ipcRenderer.invoke('artifact:getHtml', artifactId, version),
    saveMeta: (artifactId: string, meta: unknown) => ipcRenderer.invoke('artifact:saveMeta', artifactId, meta),
    saveHtml: (artifactId: string, version: number, html: string) => ipcRenderer.invoke('artifact:saveHtml', artifactId, version, html),
    list: () => ipcRenderer.invoke('artifact:list'),
    updateIndex: (entries: unknown) => ipcRenderer.invoke('artifact:updateIndex', entries),
    requestAuth: (artifactId: string, capability: string, detail: string) => ipcRenderer.invoke('artifact:requestAuth', artifactId, capability, detail),
    onAuthRequest: (cb: (_event: unknown, artifactId: string, capability: string, detail: string) => void) => { ipcRenderer.on('artifact:requestAuth', cb as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void); },
      grantAuth: (result: { granted: boolean; level: string }) => ipcRenderer.send('artifact:grantAuth', result),
      writeSkill: (dummy: string, content: string) => ipcRenderer.invoke('artifact:writeSkill', dummy, content),
  },
  device: {
    signChallenge: (params: {
      nonce: string;
      token: string;
      clientId: string;
      clientMode?: string;
      role?: string;
      scopes?: string[];
    }) =>
      ipcRenderer.invoke('device:signChallenge', params),
  },
  install: {
    run: () => ipcRenderer.invoke('install:openclaw'),
  },
  log: {
    send: (level: string, ...args: unknown[]) => ipcRenderer.invoke('log:renderer', level, ...args),
  },
  connect: {
    isLocal: (url: string) => ipcRenderer.invoke('connect:isLocal', url),
    autoApprove: () => ipcRenderer.invoke('connect:autoApprove'),
  },
  setExternalLinkMode: (mode: string) => ipcRenderer.send('set-external-link-mode', mode),
  pet: {
    emitEvent: (event: unknown) => ipcRenderer.invoke('pet:emit-event', event),
    getState: () => ipcRenderer.invoke('pet:get-state'),
    setSize: (scale: number) => ipcRenderer.invoke('pet:set-size', scale),
    setAiLink: (enabled: boolean) => ipcRenderer.invoke('pet:set-ai-link', enabled),
    toggle: () => ipcRenderer.invoke('pet:toggle'),
    onEvent: (cb: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, petEvent: unknown) => cb(petEvent)
      ipcRenderer.on('pet:event', handler)
      return () => { ipcRenderer.removeListener('pet:event', handler) }
    },
    onAiLinkChanged: (cb: (enabled: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, enabled: boolean) => cb(enabled)
      ipcRenderer.on('pet:ai-link-changed', handler)
      return () => { ipcRenderer.removeListener('pet:ai-link-changed', handler) }
    },
    move: (dx: number, dy: number) => ipcRenderer.invoke('pet:move', { dx, dy }),
  },
})
