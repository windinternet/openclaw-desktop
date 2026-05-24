import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'

const execFileAsync = promisify(execFile)

// === 开发调试：开启 CDP 远程调试端口，供 Playwright 等工具连接运行时 Chromium ===
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

const isDev = !app.isPackaged

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
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 36,
    },
  })

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
    const { stdout } = await execFileAsync('openclaw', ['config', 'get', 'gateway.auth', '--json'], { timeout: 5000 })
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
    const { stdout } = await execFileAsync('openclaw', ['config', 'file'], { timeout: 3000 })
    const path = lastLineOf(stdout)
    console.log('[main] readGatewayToken: CLI config path =', path)
    configPaths.push(path)
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
    const { stdout } = await execFileAsync('openclaw', ['gateway', 'probe', '--json', '--timeout', '5000'], { timeout: 8000 })
    probeOutput = stdout.trim()
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

ipcMain.handle('config:getPath', () => {
  return app.getPath('userData')
})

ipcMain.handle('device:signChallenge', async (_event, params: { nonce: string; token: string; clientId: string }) => {
  const identity = loadDeviceIdentity()
  if (!identity) {
    throw new Error('No device identity found')
  }

  const signedAtMs = Date.now()
  const payload = buildDeviceAuthPayloadV3({
    deviceId: identity.deviceId,
    clientId: params.clientId,
    clientMode: 'ui',
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
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

function findTerminal(): string | null {
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
      const { stdout } = require('node:child_process').execSync(`which ${cmd} 2>/dev/null || command -v ${cmd} 2>/dev/null`, { encoding: 'utf8' })
      if (stdout.trim()) return cmd
    } catch {}
  }
  return null
}

function openTerminal(command: string): void {
  const terminal = findTerminal()
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

ipcMain.handle('install:openclaw', async () => {
  const script = 'curl -fsSL https://openclaw.ai/install.sh | bash'
  openTerminal(script)
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
