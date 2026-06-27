import { app, BrowserWindow, dialog, ipcMain, Notification, protocol, shell } from 'electron'
import path from 'node:path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs'
import os from 'node:os'
import { ARTIFACT_IPC } from '../src/lib/artifact-ipc'
import { buildArtifactBridgeFetchResponse, resolveArtifactBridgeFetchRequest } from '../src/lib/artifact-bridge-fetch'
import { decideArtifactOpenTarget } from '../src/lib/artifact-open-target'
import { resolveArtifactExportRequest } from '../src/lib/artifact-export'
import { recordArtifactAuthDecision, recordArtifactBridgeCallResult } from '../src/lib/artifact-runtime-auth'
import type { ArtifactBridgeCallStatus, ArtifactMeta } from '../src/lib/artifact-types'

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

const BRIDGE_SCRIPT = `(function(){function s(m,a){var b=window.openclawArtifactBridge;if(!b||typeof b.invoke!=="function")return Promise.reject(new Error("Artifact bridge unavailable"));return b.invoke(m,a||{})}window.artifactBridge={getMeta:function(){return s("getMeta")},getHtml:function(v){return s("getHtml",{version:v})},fetch:function(u,i){return s("fetch",{url:u,init:i})},readFile:function(p){return s("readFile",{path:p})},writeFile:function(p,c){return s("writeFile",{path:p,content:c})},exportAs:function(t,c,n){return s("exportAs",typeof t==="object"?t:{type:t,content:c,fileName:n})},notify:function(t,b){return s("notify",{title:t,body:b})},exec:function(c){return s("exec",{cmd:c})}}})();`

interface ArtifactPreviewWindowContext {
  artifactId: string
  version: number
}

interface ArtifactBridgeCallPayload {
  method?: unknown
  params?: unknown
}

interface ArtifactBridgeExecution {
  result: unknown
  resultSummary?: string
}

class ArtifactBridgeDeniedError extends Error {}

class ArtifactBridgeUnsupportedError extends Error {}

const artifactPreviewWindows = new Map<number, ArtifactPreviewWindowContext>()

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

function writeMeta(artifactId: string, meta: ArtifactMeta): void {
  const dir = artifactDir(artifactId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(metaPath(artifactId), JSON.stringify(meta, null, 2))
}

function readIndex(): ArtifactMeta[] {
  const fp = indexPath()
  if (!existsSync(fp)) return []
  const value = JSON.parse(readFileSync(fp, 'utf-8'))
  return Array.isArray(value) ? value : []
}

function writeIndexEntry(meta: ArtifactMeta): void {
  const root = artifactsRoot()
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  const index = readIndex()
  const existingIndex = index.findIndex((item) => item.id === meta.id)
  if (existingIndex >= 0) index[existingIndex] = meta
  else index.push(meta)
  writeFileSync(indexPath(), JSON.stringify(index, null, 2))
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireStringParam(params: Record<string, unknown>, key: string): string {
  const value = params[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing artifact bridge parameter: ${key}`)
  }
  return value
}

function getBridgeMainWindow(): BrowserWindow | undefined {
  const windows = BrowserWindow.getAllWindows()
  return windows.find((win) => !artifactPreviewWindows.has(win.webContents.id)) ?? windows[0]
}

async function requestArtifactAuthorization(
  artifactId: string,
  capability: string,
  detail: string,
): Promise<{ granted: boolean; level: string }> {
  const requestedAt = Date.now()
  const recordDecision = (result: { granted: boolean; level: string }) => {
    const decidedAt = Date.now()
    const meta = readMeta(artifactId)
    if (meta) {
      const updatedMeta = recordArtifactAuthDecision(meta, {
        capability,
        detail,
        granted: result.granted,
        level: result.level,
        requestedAt,
        decidedAt,
      })
      writeMeta(artifactId, updatedMeta)
      writeIndexEntry(updatedMeta)
    }
    return result
  }

  const mainWindow = getBridgeMainWindow()
  if (!mainWindow) return recordDecision({ granted: false, level: 'once' })

  return new Promise<{ granted: boolean; level: string }>((resolve) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const settle = (result: { granted: boolean; level: string }) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      ipcMain.removeListener(ARTIFACT_IPC.GRANT_AUTH, handler)
      resolve(recordDecision(result))
    }
    const handler = (_e: unknown, result: { granted: boolean; level: string }) => {
      settle(result)
    }
    ipcMain.on(ARTIFACT_IPC.GRANT_AUTH, handler)
    mainWindow.webContents.send(ARTIFACT_IPC.REQUEST_AUTH, artifactId, capability, detail)
    timeout = setTimeout(() => settle({ granted: false, level: 'once' }), 60000)
  })
}

async function requireArtifactBridgeAuthorization(
  artifactId: string,
  capability: string,
  detail: string,
): Promise<void> {
  const result = await requestArtifactAuthorization(artifactId, capability, detail)
  if (!result.granted) {
    throw new ArtifactBridgeDeniedError(`Artifact bridge ${capability} denied`)
  }
}

function describeBridgeCall(method: string, params: Record<string, unknown>): string | undefined {
  switch (method) {
    case 'getHtml':
      return typeof params.version === 'number' ? `version ${params.version}` : undefined
    case 'fetch':
      return typeof params.url === 'string' ? params.url : undefined
    case 'readFile':
    case 'writeFile':
      return typeof params.path === 'string' ? params.path : undefined
    case 'exportAs':
      if (typeof params.fileName === 'string') return params.fileName
      return typeof params.type === 'string' ? params.type : undefined
    case 'notify':
      return typeof params.title === 'string' ? params.title : undefined
    case 'exec':
      return typeof params.cmd === 'string' ? params.cmd : undefined
    default:
      return undefined
  }
}

function bridgeStatusFromError(error: unknown): ArtifactBridgeCallStatus {
  if (error instanceof ArtifactBridgeDeniedError) return 'denied'
  if (error instanceof ArtifactBridgeUnsupportedError) return 'unsupported'
  return 'failed'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function recordArtifactBridgeCall(
  artifactId: string,
  params: {
    method: string
    detail?: string
    status: ArtifactBridgeCallStatus
    resultSummary?: string
    error?: string
    startedAt: number
    endedAt: number
  },
): void {
  const meta = readMeta(artifactId)
  if (!meta) return

  const updatedMeta = recordArtifactBridgeCallResult(meta, params)
  writeMeta(artifactId, updatedMeta)
  writeIndexEntry(updatedMeta)
}

async function handleArtifactBridgeCall(
  context: ArtifactPreviewWindowContext,
  payload: ArtifactBridgeCallPayload,
): Promise<unknown> {
  if (!isRecord(payload) || typeof payload.method !== 'string') {
    throw new Error('Invalid artifact bridge call')
  }

  const method = payload.method
  const params = isRecord(payload.params) ? payload.params : {}
  const detail = describeBridgeCall(method, params)
  const startedAt = Date.now()

  try {
    const execution = await executeArtifactBridgeCall(context, method, params, detail)
    const endedAt = Date.now()
    recordArtifactBridgeCall(context.artifactId, {
      method,
      detail,
      status: 'succeeded',
      resultSummary: execution.resultSummary,
      startedAt,
      endedAt,
    })
    return execution.result
  } catch (error) {
    const endedAt = Date.now()
    recordArtifactBridgeCall(context.artifactId, {
      method,
      detail,
      status: bridgeStatusFromError(error),
      error: errorMessage(error),
      startedAt,
      endedAt,
    })
    throw error
  }
}

async function executeArtifactBridgeCall(
  context: ArtifactPreviewWindowContext,
  method: string,
  params: Record<string, unknown>,
  detail?: string,
): Promise<ArtifactBridgeExecution> {
  switch (method) {
    case 'getMeta':
      return { result: readMeta(context.artifactId), resultSummary: 'metadata loaded' }
    case 'getHtml': {
      const requestedVersion = params.version
      const version =
        typeof requestedVersion === 'number' && Number.isInteger(requestedVersion) ? requestedVersion : context.version
      const fp = htmlPath(context.artifactId, version)
      if (!existsSync(fp)) return { result: null, resultSummary: `version ${version} html missing` }
      const html = readFileSync(fp, 'utf-8')
      return { result: html, resultSummary: `version ${version} html ${html.length} chars` }
    }
    case 'readFile': {
      const filePath = requireStringParam(params, 'path')
      await requireArtifactBridgeAuthorization(context.artifactId, 'readFile', detail ?? filePath)
      const content = readFileSync(filePath, 'utf-8')
      return {
        result: content,
        resultSummary: `read ${Buffer.byteLength(content, 'utf-8')} bytes`,
      }
    }
    case 'writeFile': {
      const filePath = requireStringParam(params, 'path')
      const content = String(params.content ?? '')
      await requireArtifactBridgeAuthorization(context.artifactId, 'writeFile', detail ?? filePath)
      writeFileSync(filePath, content, 'utf-8')
      return {
        result: {
          ok: true,
          path: filePath,
          bytes: Buffer.byteLength(content, 'utf-8'),
        },
        resultSummary: `wrote ${Buffer.byteLength(content, 'utf-8')} bytes`,
      }
    }
    case 'notify': {
      const title = typeof params.title === 'string' ? params.title : 'OpenClaw Artifact'
      const body = typeof params.body === 'string' ? params.body : ''
      await requireArtifactBridgeAuthorization(context.artifactId, 'notify', detail ?? title)
      const supported = Notification.isSupported()
      if (supported) new Notification({ title, body }).show()
      return {
        result: { ok: true, supported },
        resultSummary: supported ? 'notification shown' : 'notification unsupported',
      }
    }
    case 'exportAs': {
      const meta = readMeta(context.artifactId)
      if (!meta) throw new Error('Artifact not found')
      const fp = htmlPath(context.artifactId, context.version)
      const currentHtml = existsSync(fp) ? readFileSync(fp, 'utf-8') : null
      const exportRequest = resolveArtifactExportRequest(params, meta, currentHtml)
      await requireArtifactBridgeAuthorization(context.artifactId, 'export', detail ?? exportRequest.fileName)
      const saveOptions = {
        defaultPath: exportRequest.fileName,
        filters: exportRequest.filters,
      }
      const mainWindow = getBridgeMainWindow()
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, saveOptions)
        : await dialog.showSaveDialog(saveOptions)
      if (result.canceled || !result.filePath) {
        return {
          result: { ok: false, canceled: true },
          resultSummary: 'export cancelled',
        }
      }
      writeFileSync(result.filePath, exportRequest.content, 'utf-8')
      return {
        result: {
          ok: true,
          filePath: result.filePath,
          bytes: exportRequest.bytes,
          mimeType: exportRequest.mimeType,
          type: exportRequest.type,
        },
        resultSummary: `exported ${exportRequest.bytes} bytes`,
      }
    }
    case 'fetch': {
      const fetchRequest = resolveArtifactBridgeFetchRequest(params)
      await requireArtifactBridgeAuthorization(context.artifactId, 'network.fetch', detail ?? fetchRequest.url)
      const response = await fetch(fetchRequest.url, {
        method: fetchRequest.method,
        headers: fetchRequest.headers,
        body: fetchRequest.body,
      })
      const result = await buildArtifactBridgeFetchResponse(response, fetchRequest.maxBytes)
      return {
        result,
        resultSummary: `network ${result.status} ${result.bytes} bytes${result.truncated ? ' truncated' : ''}`,
      }
    }
    case 'exec':
      throw new ArtifactBridgeUnsupportedError('Artifact bridge method exec is not implemented yet')
    default:
      throw new ArtifactBridgeUnsupportedError(`Unknown artifact bridge method: ${method}`)
  }
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
            preload: path.join(__dirname, 'artifact-preload.js'),
          },
        })
        if (meta?.title) win.setTitle(meta.title)
        artifactPreviewWindows.set(win.webContents.id, { artifactId: target.artifactId, version: target.version })
        win.on('closed', () => {
          artifactPreviewWindows.delete(win.webContents.id)
        })
        win.webContents.setWindowOpenHandler(({ url }) => {
          void shell.openExternal(url)
          return { action: 'deny' }
        })
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
    writeMeta(artifactId, meta)
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
    return requestArtifactAuthorization(artifactId, capability, detail)
  })

  ipcMain.handle(ARTIFACT_IPC.BRIDGE_CALL, async (event, payload: ArtifactBridgeCallPayload) => {
    const context = artifactPreviewWindows.get(event.sender.id)
    const senderUrl = event.senderFrame?.url ?? event.sender.getURL()
    if (!context || !senderUrl.startsWith(`artifact://${context.artifactId}.v`)) {
      throw new Error('Artifact Bridge is only available inside Artifact preview windows')
    }

    return handleArtifactBridgeCall(context, payload)
  })
}
