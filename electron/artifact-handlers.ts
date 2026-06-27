import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron'
import path from 'node:path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs'
import os from 'node:os'
import { ARTIFACT_IPC } from '../src/lib/artifact-ipc'
import { decideArtifactOpenTarget } from '../src/lib/artifact-open-target'
import type { ArtifactMeta } from '../src/lib/artifact-types'

function artifactsRoot(): string {
  return path.join(app.getPath('userData'), 'storage', 'artifacts')
}

function artifactDir(artifactId: string): string {
  if (!/^art_[a-z0-9]+$/.test(artifactId)) throw new Error('Invalid artifact id')
  return path.join(artifactsRoot(), artifactId)
}

function metaPath(artifactId: string): string {
  return path.join(artifactDir(artifactId), 'meta.json')
}

function htmlPath(artifactId: string, version: number): string {
  return path.join(artifactDir(artifactId), `v${version}.html`)
}

function filesDir(artifactId: string): string {
  return path.join(artifactDir(artifactId), 'files')
}

function indexPath(): string {
  return path.join(artifactsRoot(), 'index.json')
}

const CSP_HEADER = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "media-src 'self'",
].join('; ')

const BRIDGE_SCRIPT = `(function(){var p={};var n=0;window.artifactBridge={getMeta:function(){return s("getMeta")},getHtml:function(v){return s("getHtml",{version:v})},fetch:function(u,i){return s("fetch",{url:u,init:i})},readFile:function(p){return s("readFile",{path:p})},writeFile:function(p,c){return s("writeFile",{path:p,content:c})},exportAs:function(t){return s("exportAs",{type:t})},notify:function(t,b){return s("notify",{title:t,body:b})},exec:function(c){return s("exec",{cmd:c})}};function s(m,a){return new Promise(function(r,e){var i=++n;p[i]={resolve:r,reject:e};window.postMessage({artifactBridge:true,id:i,method:m,params:a||{}},"*");setTimeout(function(){if(p[i]){delete p[i];e(new Error("Bridge timeout"))}},30000)})}window.addEventListener("message",function(e){if(!e.data||!e.data.artifactBridge)return;var d=p[e.data.id];if(!d)return;delete p[e.data.id];if(e.data.error)d.reject(new Error(e.data.error));else d.resolve(e.data.result)})})();`

export function registerArtifactProtocol(): void {
  protocol.handle('artifact', (request) => {
    const url = new URL(request.url)
    const [artifactId, versionPart] = url.hostname.split('.')
    const versionStr = versionPart.replace('v', '')
    const version = parseInt(versionStr, 10)
    if (isNaN(version) || version < 1) {
      return new Response('Invalid version', { status: 400 })
    }

    const filePath = htmlPath(artifactId, version)
    if (!existsSync(filePath)) {
      return new Response('Artifact not found', { status: 404 })
    }

    const html = readFileSync(filePath, 'utf-8')
    const injectedHtml = html.replace('</body>', `<script>${BRIDGE_SCRIPT}</script></body>`)

    return new Response(injectedHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': CSP_HEADER,
      },
    })
  })
}

function readMeta(artifactId: string): ArtifactMeta | null {
  const fp = metaPath(artifactId)
  if (!existsSync(fp)) return null
  return JSON.parse(readFileSync(fp, 'utf-8'))
}

function sanitizeFileName(fileName: string): string {
  const invalid = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const base = path
    .basename(fileName)
    .split('')
    .map((char) => (invalid.has(char) || char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .trim()
  return base || 'artifact-file'
}

function detectMimeType(fileName: string): string | undefined {
  const ext = path.extname(fileName).toLowerCase()
  const known: Record<string, string> = {
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
  }
  return known[ext]
}

export function registerArtifactIpcHandlers(): void {
  ipcMain.handle(ARTIFACT_IPC.OPEN, async (_event, artifactId: string, version: number) => {
    const meta = readMeta(artifactId)
    const target = decideArtifactOpenTarget(meta, version)

    switch (target.kind) {
      case 'html-preview': {
        const win = new BrowserWindow({
          width: 1200,
          height: 900,
          title: meta?.title ?? '产物',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        })
        if (meta?.title) win.setTitle(meta.title)
        win.loadURL(`artifact://${target.artifactId}.v${target.version}`)
        return win.id
      }
      case 'local-file': {
        const error = await shell.openPath(target.path)
        if (error) throw new Error(error)
        return 0
      }
      case 'external-url': {
        await shell.openExternal(target.url)
        return 0
      }
      case 'unavailable':
        throw new Error(target.reason === 'missing-meta' ? 'Artifact not found' : 'Artifact has no file path or URL')
    }
  })

  ipcMain.handle(ARTIFACT_IPC.GET_META, async (_event, artifactId: string) => {
    return readMeta(artifactId)
  })

  ipcMain.handle(ARTIFACT_IPC.GET_HTML, async (_event, artifactId: string, version?: number) => {
    const meta = readMeta(artifactId)
    if (!meta) return null
    const v = version ?? meta.currentVersion
    const fp = htmlPath(artifactId, v)
    return existsSync(fp) ? readFileSync(fp, 'utf-8') : null
  })

  ipcMain.handle(ARTIFACT_IPC.LIST, async () => {
    if (!existsSync(indexPath())) return []
    return JSON.parse(readFileSync(indexPath(), 'utf-8'))
  })

  ipcMain.handle(ARTIFACT_IPC.SAVE_META, async (_event, artifactId: string, meta: ArtifactMeta) => {
    const dir = artifactDir(artifactId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(metaPath(artifactId), JSON.stringify(meta, null, 2))
  })

  ipcMain.handle(ARTIFACT_IPC.SAVE_HTML, async (_event, artifactId: string, version: number, html: string) => {
    const dir = artifactDir(artifactId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(htmlPath(artifactId, version), html)
  })

  ipcMain.handle(
    ARTIFACT_IPC.IMPORT_FILE,
    async (_event, artifactId: string, sourcePath: string, preferredFileName?: string) => {
      const stat = statSync(sourcePath)
      if (!stat.isFile()) throw new Error('Source path is not a file')

      const dir = filesDir(artifactId)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

      const fileName = sanitizeFileName(preferredFileName || sourcePath)
      const targetPath = path.join(dir, fileName)
      copyFileSync(sourcePath, targetPath)

      return {
        filePath: targetPath,
        fileName,
        fileSize: stat.size,
        mimeType: detectMimeType(fileName),
      }
    },
  )

  ipcMain.handle(ARTIFACT_IPC.UPDATE_INDEX, async (_event, entries: unknown) => {
    const root = artifactsRoot()
    if (!existsSync(root)) mkdirSync(root, { recursive: true })
    writeFileSync(indexPath(), JSON.stringify(entries, null, 2))
  })

  ipcMain.handle(ARTIFACT_IPC.WRITE_SKILL, async (_event, _dummy: string, content: string) => {
    const skillDir = path.join(os.homedir(), '.openclaw', 'workspace', 'skills', 'artifact-generator')
    if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true })
    writeFileSync(path.join(skillDir, 'SKILL.md'), content)
  })

  ipcMain.handle(ARTIFACT_IPC.REQUEST_AUTH, async (_event, artifactId: string, capability: string, detail: string) => {
    const allWindows = BrowserWindow.getAllWindows()
    const mainWindow = allWindows[0]
    if (!mainWindow) return { granted: false, level: 'once' }

    return new Promise<{ granted: boolean; level: string }>((resolve) => {
      const handler = (_e: unknown, result: { granted: boolean; level: string }) => {
        ipcMain.removeListener(ARTIFACT_IPC.GRANT_AUTH, handler)
        resolve(result)
      }
      ipcMain.on(ARTIFACT_IPC.GRANT_AUTH, handler)
      mainWindow.webContents.send(ARTIFACT_IPC.REQUEST_AUTH, artifactId, capability, detail)
      setTimeout(() => {
        ipcMain.removeListener(ARTIFACT_IPC.GRANT_AUTH, handler)
        resolve({ granted: false, level: 'once' })
      }, 60000)
    })
  })
}
