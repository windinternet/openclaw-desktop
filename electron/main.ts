import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import path from 'node:path'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { fetchSkillMarketplaceSkills } from '../src/lib/skill-marketplace'
import type { SkillMarketplaceSearchParams } from '../src/lib/types'
import { registerLocalFileStorageHandlers } from './local-storage'
import { registerArtifactProtocol, registerArtifactIpcHandlers } from './artifact-handlers'
import { setupMainLogger, writeRenderer } from './logger'

const execFileAsync = promisify(execFile)

const isWin = process.platform === 'win32'

function execOpenclaw(
  args: string[],
  options?: { timeout?: number; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  const timeout = options?.timeout ?? 5000
  const maxBuffer = options?.maxBuffer ?? 1024 * 1024
  if (isWin) {
    return execFileAsync('openclaw', args, { shell: true, timeout, maxBuffer })
  }
  return execFileAsync('openclaw', args, { timeout, maxBuffer }).catch(() =>
    execFileAsync('bash', ['-lc', `openclaw ${args.join(' ')}`], { timeout, maxBuffer }),
  )
}

// === 开发调试：开启 CDP 远程调试端口，供 Playwright 等工具连接运行时 Chromium ===
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

const isDev = !app.isPackaged

let externalLinkMode: 'system' | 'internal' = 'system';

/** 判断目标 URL 是否与当前 Electron 窗口同源 */
function isSameOrigin(currentUrl: string, targetUrl: string): boolean {
  try {
    const cur = new URL(currentUrl);
    const tgt = new URL(targetUrl);
    return cur.origin === tgt.origin;
  } catch {
    return false;
  }
}


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      ...(process.platform !== 'linux' ? { color: '#00000000' } : {}),
      symbolColor: '#ffffff',
      height: 36,
    },
  })


  // 拦截外部链接在系统浏览器打开，防止替换当前窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    // 同源链接放行（指向自己的服务，不是外部链接）
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { action: 'allow' };
    }
    if (isSameOrigin(win.webContents.getURL(), url)) return { action: 'allow' };
    if (externalLinkMode === 'system') {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    // internal mode: open in new Electron window
    const child = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    child.loadURL(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    // 同源链接放行
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return;
    }
    if (isSameOrigin(win.webContents.getURL(), url)) return;
    if (externalLinkMode === 'system') {
      event.preventDefault();
      shell.openExternal(url);
      return;
    }
    // internal mode: open in new window, prevent current window navigation
    event.preventDefault();
    const child = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    child.loadURL(url);
  });

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

interface DiscoveredResult {
  url: string
  name?: string
  version?: string
  host?: string
  ip?: string
  authMode?: string
  token?: string
}

async function resolveAuthMode(): Promise<string | undefined> {
  try {
    const { stdout } = await execOpenclaw(['config', 'get', 'gateway.auth', '--json'], { timeout: 5000 })
    const raw = stdout.trim()
    console.log('[main] resolveAuthMode: raw =', raw.slice(0, 80))
    const auth = JSON.parse(raw)
    console.log('[main] resolveAuthMode: mode =', auth?.mode)
    return typeof auth?.mode === 'string' ? auth.mode : undefined
  } catch (err) {
    console.log('[main] resolveAuthMode: failed', String(err).slice(0, 100))
    return undefined
  }
}

async function readGatewayToken(): Promise<string | undefined> {
  const configPaths: string[] = []
  try {
    const { stdout } = await execOpenclaw(['config', 'file'], { timeout: 3000 })
    const resolvedPath = lastLineOf(stdout)
    console.log('[main] readGatewayToken: CLI config path =', resolvedPath)
    configPaths.push(resolvedPath.startsWith('~') ? path.join(os.homedir(), resolvedPath.slice(1)) : resolvedPath)
  } catch (err) {
    console.log('[main] readGatewayToken: CLI config file failed:', err)
  }
  const defaultPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
  console.log('[main] readGatewayToken: default path =', defaultPath)
  configPaths.push(defaultPath)

  for (const configPath of configPaths) {
    try {
      console.log('[main] readGatewayToken: trying', configPath)
      const configRaw = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(configRaw)
      const token = config?.gateway?.auth?.token
      console.log('[main] readGatewayToken: token type =', typeof token, 'length =', typeof token === 'string' ? token.length : 'N/A', 'preview =', typeof token === 'string' ? token.slice(0, 8) + '...' : String(token))
      if (typeof token === 'string' && token.length > 0) {
        return token
      }
    } catch (err) {
      console.log('[main] readGatewayToken: failed to read', configPath, err)
    }
  }
  console.log('[main] readGatewayToken: no token found')
  return undefined
}

interface DeviceIdentity {
  deviceId: string
  publicKeyPem: string
  privateKeyPem: string
}

function loadDeviceIdentity(): DeviceIdentity | null {
  try {
    const identityPath = path.join(os.homedir(), '.openclaw', 'identity', 'device.json')
    const raw = readFileSync(identityPath, 'utf-8')
    const identity = JSON.parse(raw)
    if (
      typeof identity.deviceId === 'string' &&
      typeof identity.publicKeyPem === 'string' &&
      typeof identity.privateKeyPem === 'string'
    ) {
      return {
        deviceId: identity.deviceId,
        publicKeyPem: identity.publicKeyPem,
        privateKeyPem: identity.privateKeyPem,
      }
    }
    return null
  } catch {
    return null
  }
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem)
  const spki = key.export({ type: 'spki', format: 'der' }) as Buffer
  const PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
  if (spki.length === PREFIX.length + 32 && spki.subarray(0, PREFIX.length).equals(PREFIX)) {
    return spki.subarray(PREFIX.length)
  }
  return spki
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function signDevicePayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem)
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), key)
  return base64UrlEncode(sig)
}

function buildDeviceAuthPayloadV3(params: {
  deviceId: string
  clientId: string
  clientMode: string
  role: string
  scopes: string[]
  signedAtMs: number
  token: string
  nonce: string
  platform: string
}): string {
  const scopesStr = params.scopes.join(',')
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopesStr,
    String(params.signedAtMs),
    params.token,
    params.nonce,
    params.platform,
    '',
  ].join('|')
}

function lastLineOf(stdout: string): string {
  return stdout.trim().split('\n').pop()!.trim()
}

ipcMain.handle('discover:scan', async () => {
  let probeOutput: string
  try {
    const result = await execOpenclaw(['gateway', 'probe', '--json', '--timeout', '5000'], { timeout: 8000 })
    probeOutput = result.stdout.trim()
  } catch {
    return []
  }

  let probe: Record<string, unknown>
  try {
    probe = JSON.parse(probeOutput)
  } catch {
    return []
  }

  const targets = Array.isArray(probe.targets) ? probe.targets : []
  const results: DiscoveredResult[] = []

  for (const target of targets) {
    if (typeof target !== 'object' || target === null) continue
    const t = target as Record<string, unknown>
    const connect = t.connect as Record<string, unknown> | undefined

    if (!connect?.ok || typeof t.url !== 'string') continue

    const self = t.self as Record<string, unknown> | undefined
    const auth = t.auth as Record<string, unknown> | undefined

    results.push({
      url: t.url,
      name: typeof self?.host === 'string' ? self.host : undefined,
      version: typeof self?.version === 'string' ? self.version : undefined,
      host: typeof self?.host === 'string' ? self.host : undefined,
      ip: typeof self?.ip === 'string' ? self.ip : undefined,
      authMode: typeof auth?.capability === 'string' ? auth.capability : undefined,
    })
  }

  if (results.length === 0) {
    console.log('[main] discover:scan: no reachable targets')
    return []
  }

  console.log('[main] discover:scan: found', results.length, 'targets, resolving auth mode...')
  const authMode = await resolveAuthMode()
  console.log('[main] discover:scan: authMode =', authMode)
  if (authMode) {
    for (const r of results) {
      r.authMode = authMode
    }
  }

  if (authMode === 'token') {
    const token = await readGatewayToken()
    if (token) {
      for (const r of results) {
        r.token = token
      }
    }
  }

  return results
})

function getLocalAddresses(): Set<string> {
  const addrs = new Set<string>()
  addrs.add('localhost')
  addrs.add('127.0.0.1')
  addrs.add('::1')
  addrs.add('0.0.0.0')

  const host = os.hostname()
  addrs.add(host)
  addrs.add(`${host}.local`)

  const nets = os.networkInterfaces()
  for (const [, interfaces] of Object.entries(nets)) {
    if (!interfaces) continue
    for (const iface of interfaces) {
      if (iface.address) addrs.add(iface.address)
    }
  }

  return addrs
}

async function isLocalUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname

    const localAddrs = getLocalAddresses()
    if (localAddrs.has(host)) return true

    if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true

    try {
      const { address } = await lookup(host)
      if (localAddrs.has(address)) return true
    } catch {
      // DNS failed, can't determine
    }

    return false
  } catch {
    return false
  }
}

ipcMain.handle('connect:isLocal', async (_event, url: string) => {
  return isLocalUrl(url)
})

ipcMain.handle('connect:autoApprove', async () => {
    let configPath: string
    try {
      const result = await execOpenclaw(['config', 'file'], { timeout: 3000 })
      configPath = result.stdout.trim().split('\n').pop()!.trim()
    } catch {
      return { success: false, error: '无法读取 OpenClaw 配置文件路径' }
    }

    if (configPath.startsWith('~')) {
      configPath = path.join(os.homedir(), configPath.slice(1))
    }

  let config: Record<string, unknown>
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    config = {}
  }

  const gateway = (config.gateway as Record<string, unknown> | undefined) ?? {}
  const controlUi = (gateway.controlUi as Record<string, unknown> | undefined) ?? {}
  const allowedOrigins: string[] = Array.isArray(controlUi.allowedOrigins)
    ? (controlUi.allowedOrigins as string[])
    : []

  const neededOrigins = ['file://', 'null']
  let changed = false

  for (const origin of neededOrigins) {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin)
      changed = true
    }
  }

  if (changed) {
    const updatedControlUi = { ...controlUi, allowedOrigins }
    const updatedGateway = { ...gateway, controlUi: updatedControlUi }
    const updatedConfig = { ...config, gateway: updatedGateway }

    try {
      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
      console.log('[main] autoApprove: wrote config with origins:', allowedOrigins)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '写入配置失败' }
    }
  } else {
    console.log('[main] autoApprove: origins already configured:', allowedOrigins)
  }

  try {
    const result = await execOpenclaw(['gateway', 'restart'], { timeout: 10000 })
    console.log('[main] autoApprove: gateway restart stdout:', result.stdout.trim().slice(0, 200))
  } catch (restartErr) {
    console.log('[main] autoApprove: gateway restart failed:', String(restartErr).slice(0, 200))
    return { success: true, origins: allowedOrigins, restartFailed: true }
  }

  return { success: true, origins: allowedOrigins }
})

ipcMain.handle('config:getPath', () => {
  return app.getPath('userData')
})

ipcMain.handle('notification:show', (_event, params: { title?: string; body?: string }) => {
  if (!Notification.isSupported()) return false
  new Notification({
    title: params.title || 'OpenClaw',
    body: params.body || '',
    silent: true,
  }).show()
  return true
})

ipcMain.handle('log:renderer', (_event, level: string, ...args: unknown[]) => {
  writeRenderer(level, ...args)
})

ipcMain.handle('marketplace:search', async (_event, params: SkillMarketplaceSearchParams) => {
  return fetchSkillMarketplaceSkills(params)
})

registerLocalFileStorageHandlers()
registerArtifactIpcHandlers()

ipcMain.handle('device:signChallenge', async (_event, params: {
  nonce: string;
  token: string;
  clientId: string;
  clientMode?: string;
  role?: string;
  scopes?: string[];
}) => {
  const identity = loadDeviceIdentity()
  if (!identity) {
    throw new Error('No device identity found')
  }

  const signedAtMs = Date.now()
  const payload = buildDeviceAuthPayloadV3({
    deviceId: identity.deviceId,
    clientId: params.clientId,
    clientMode: params.clientMode || 'ui',
    role: params.role || 'operator',
    scopes: params.scopes && params.scopes.length > 0 ? params.scopes : ['operator.read', 'operator.write'],
    signedAtMs,
    token: params.token,
    nonce: params.nonce,
    platform: process.platform,
  })

  const signature = signDevicePayload(identity.privateKeyPem, payload)
  const publicKey = base64UrlEncode(derivePublicKeyRaw(identity.publicKeyPem))

  return {
    deviceId: identity.deviceId,
    publicKey,
    signature,
    signedAt: signedAtMs,
    nonce: params.nonce,
  }
})

function findUnixTerminal(): string | null {
  const candidates = [
    'x-terminal-emulator',
    'gnome-terminal',
    'deepin-terminal',
    'konsole',
    'xfce4-terminal',
    'mate-terminal',
    'lxterminal',
    'xterm',
  ]
  for (const cmd of candidates) {
    try {
      const stdout = execFileSync('sh', ['-lc', `which ${cmd} 2>/dev/null || command -v ${cmd} 2>/dev/null`], { encoding: 'utf8' })
      if (stdout.trim()) return cmd
    } catch {
      // Try the next terminal candidate.
    }
  }
  return null
}

function openUnixTerminal(command: string): void {
  const terminal = findUnixTerminal()
  if (!terminal) {
    spawn('xterm', ['-e', command], { detached: true, stdio: 'ignore' }).unref()
    return
  }

  const args: string[] = []
  switch (terminal) {
    case 'gnome-terminal':
      args.push('--', 'bash', '-c', `${command}; echo; echo "按 Enter 关闭..."; read`)
      break
    case 'deepin-terminal':
      args.push('-e', `bash -c '${command}; echo; echo "按 Enter 关闭..."; read'`)
      break
    case 'konsole':
      args.push('-e', 'bash', '-c', `${command}; echo; echo "按 Enter 关闭..."; read`)
      break
    case 'x-terminal-emulator':
    case 'xfce4-terminal':
    case 'mate-terminal':
    case 'lxterminal':
      args.push('-e', `bash -c '${command}; echo; echo "按 Enter 关闭..."; read'`)
      break
    default:
      args.push('-e', `bash -c '${command}; echo; echo "按 Enter 关闭..."; read'`)
  }

  spawn(terminal, args, { detached: true, stdio: 'ignore' }).unref()
}

function findWindowsTerminal(): 'wt.exe' | 'powershell.exe' | 'cmd.exe' {
  try {
    const stdout = execFileSync('cmd.exe', ['/c', 'where wt 2>nul'], { encoding: 'utf8' })
    if (stdout.trim()) return 'wt.exe'
  } catch {
    // Windows Terminal not found, try PowerShell
  }
  try {
    const stdout = execFileSync('cmd.exe', ['/c', 'where powershell 2>nul'], { encoding: 'utf8' })
    if (stdout.trim()) return 'powershell.exe'
  } catch {
    // PowerShell not found, fallback to cmd
  }
  return 'cmd.exe'
}

function openWindowsTerminal(command: string): void {
  const terminal = findWindowsTerminal()

  if (terminal === 'wt.exe') {
    spawn('wt', ['powershell', '-NoExit', '-Command', command], { detached: true, stdio: 'ignore' }).unref()
  } else if (terminal === 'powershell.exe') {
    spawn('powershell', ['-NoExit', '-Command', command], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('cmd.exe', ['/c', 'start', 'OpenClaw Install', 'cmd.exe', '/k', command], { detached: true, stdio: 'ignore' }).unref()
  }
}

function findTerminal(): string | null {
  if (isWin) return findWindowsTerminal()
  return findUnixTerminal()
}

function openTerminal(command: string): void {
  if (isWin) {
    openWindowsTerminal(command)
    return
  }
  openUnixTerminal(command)
}

ipcMain.handle('install:openclaw', async () => {
  if (isWin) {
    // Windows 上没有 curl|bash 安装方式，引导用户到文档页
    shell.openExternal('https://openclaw.ai/docs/install')
    return
  }
  const script = 'curl -fsSL https://openclaw.ai/install.sh | bash'
  openTerminal(script)
})

ipcMain.on('set-external-link-mode', (_event, mode: string) => {
  if (mode === 'system' || mode === 'internal') {
    externalLinkMode = mode;
  }
});

app.whenReady().then(() => {
  setupMainLogger()
  registerArtifactProtocol()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
