import crypto from 'node:crypto'
import path from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'

const writeQueues = new Map<string, Promise<void>>()

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  await rename(tempPath, filePath)
}

export async function updateJsonFile<T>(
  filePath: string,
  fallback: T,
  update: (current: T) => T | Promise<T>,
): Promise<T> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve()

  let resolveCurrent!: () => void
  let rejectCurrent!: (error: unknown) => void
  const current = new Promise<void>((resolve, reject) => {
    resolveCurrent = resolve
    rejectCurrent = reject
  })

  writeQueues.set(filePath, previous.then(() => current, () => current))

  try {
    await previous.catch(() => undefined)
    const existing = await readJsonFile(filePath, fallback)
    const next = await update(existing)
    await writeJsonFile(filePath, next)
    resolveCurrent()
    return next
  } catch (error) {
    rejectCurrent(error)
    throw error
  } finally {
    if (writeQueues.get(filePath) === current) {
      writeQueues.delete(filePath)
    }
  }
}
