import { app } from 'electron'
import path from 'node:path'
import { mkdirSync, appendFileSync } from 'node:fs'

let logsDir: string | null = null

function ensureLogsDir(): string {
  if (!logsDir) {
    logsDir = path.join(app.getPath('userData'), 'logs')
    mkdirSync(logsDir, { recursive: true })
  }
  return logsDir
}

function getLogPath(prefix: string): string {
  const dir = ensureLogsDir()
  const date = new Date().toISOString().slice(0, 10)
  return path.join(dir, `${prefix}-${date}.log`)
}

function formatNow(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 23)
  return `${date} ${time}`
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      }
      return String(a)
    })
    .join(' ')
}

function writeLine(prefix: string, level: string, args: unknown[]): void {
  try {
    const filePath = getLogPath(prefix)
    const line = `[${formatNow()}] [${prefix.toUpperCase()}:${level}] ${formatArgs(args)}\n`
    appendFileSync(filePath, line, 'utf-8')
  } catch {
    /* ignore logging errors */
  }
}

export function writeMain(level: string, ...args: unknown[]): void {
  writeLine('main', level, args)
}

export function writeRenderer(level: string, ...args: unknown[]): void {
  writeLine('renderer', level, args)
}

export function setupMainLogger(): void {
  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  }

  console.log = (...a: unknown[]) => {
    orig.log(...a)
    writeLine('main', 'LOG', a)
  }
  console.warn = (...a: unknown[]) => {
    orig.warn(...a)
    writeLine('main', 'WARN', a)
  }
  console.error = (...a: unknown[]) => {
    orig.error(...a)
    writeLine('main', 'ERROR', a)
  }
  console.info = (...a: unknown[]) => {
    orig.info(...a)
    writeLine('main', 'INFO', a)
  }
  console.debug = (...a: unknown[]) => {
    orig.debug(...a)
    writeLine('main', 'DEBUG', a)
  }

  process.on('uncaughtException', (err) => {
    writeLine('main', 'FATAL', [err.stack || err.message])
    orig.error('Uncaught Exception:', err)
  })

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason)
    writeLine('main', 'FATAL', [message])
    orig.error('Unhandled Rejection:', reason)
  })
}
