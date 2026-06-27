import { contextBridge, ipcRenderer } from 'electron'

function getStartupThemeMode(): 'light' | 'dark' {
  const arg = process.argv.find((value) => value.startsWith('--openclaw-startup-theme-mode='))
  const mode = arg?.split('=')[1]
  return mode === 'light' ? 'light' : 'dark'
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  startupThemeMode: getStartupThemeMode(),
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
    chooseDirectory: () => ipcRenderer.invoke('repository:chooseDirectory'),
    getDefaultPath: () => ipcRenderer.invoke('repository:getDefaultPath'),
    inspect: (repoPath: string) => ipcRenderer.invoke('repository:inspect', repoPath),
    bootstrap: (repoPath: string) => ipcRenderer.invoke('repository:bootstrap', repoPath),
    init: (repoPath: string) => ipcRenderer.invoke('repository:init', repoPath),
    listTree: (repoPath: string, maxEntries?: number) => ipcRenderer.invoke('repository:listTree', repoPath, maxEntries),
    listMarkdown: (repoPath: string, directory: string) => ipcRenderer.invoke('repository:listMarkdown', repoPath, directory),
    readText: (repoPath: string, relativePath: string) => ipcRenderer.invoke('repository:readText', repoPath, relativePath),
    writeText: (repoPath: string, relativePath: string, content: string) =>
      ipcRenderer.invoke('repository:writeText', repoPath, relativePath, content),
    search: (repoPath: string, query: string, directories: string[]) =>
      ipcRenderer.invoke('repository:search', repoPath, query, directories),
    gitStatus: (repoPath: string) => ipcRenderer.invoke('repository:gitStatus', repoPath),
    gitDiff: (repoPath: string) => ipcRenderer.invoke('repository:gitDiff', repoPath),
    gitLog: (repoPath: string, relativePath: string, limit?: number) =>
      ipcRenderer.invoke('repository:gitLog', repoPath, relativePath, limit),
    gitCommit: (repoPath: string, message: string) => ipcRenderer.invoke('repository:gitCommit', repoPath, message),
    watchAgentsFile: async (repoPath: string, cb: (event: { watchId: string; repoPath: string }) => void) => {
      let activeWatchId: string | null = null
      const handler = (_event: Electron.IpcRendererEvent, payload: { watchId: string; repoPath: string }) => {
        if (payload.watchId === activeWatchId) cb(payload)
      }
      ipcRenderer.on('repository:agentsFileChanged', handler)
      try {
        const result = await ipcRenderer.invoke('repository:watchAgentsFile', repoPath) as { watchId: string; repoPath: string }
        activeWatchId = result.watchId
        return () => {
          ipcRenderer.removeListener('repository:agentsFileChanged', handler)
          void ipcRenderer.invoke('repository:unwatchAgentsFile', result.watchId)
        }
      } catch (error) {
        ipcRenderer.removeListener('repository:agentsFileChanged', handler)
        throw error
      }
    },
  },
  artifact: {
    open: (artifactId: string, version: number) => ipcRenderer.invoke('artifact:open', artifactId, version),
    getMeta: (artifactId: string) => ipcRenderer.invoke('artifact:getMeta', artifactId),
    getHtml: (artifactId: string, version?: number) => ipcRenderer.invoke('artifact:getHtml', artifactId, version),
    saveMeta: (artifactId: string, meta: unknown) => ipcRenderer.invoke('artifact:saveMeta', artifactId, meta),
    saveHtml: (artifactId: string, version: number, html: string) => ipcRenderer.invoke('artifact:saveHtml', artifactId, version, html),
    importFile: (artifactId: string, sourcePath: string, preferredFileName?: string) => ipcRenderer.invoke('artifact:importFile', artifactId, sourcePath, preferredFileName),
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
