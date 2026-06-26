import { app, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { execFile } from 'node:child_process'
import * as fs from 'node:fs'
import { promisify } from 'node:util'
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import {
  resolveRepoPath,
  resolveSafeExistingRepoPath,
  resolveSafeWritableRepoPath,
} from '../src/lib/repository-path-safety'

const execFileAsync = promisify(execFile)
const agentsFileWatchers = new Map<string, {
  watcher: fs.FSWatcher;
  sender: Electron.WebContents;
  webContentsId: number;
  repoPath: string;
  destroyedHandler: () => void;
}>()
let agentsFileWatchSeq = 0

const REQUIRED_TEMPLATE_ENTRIES = [
  'AGENTS.md',
  'README.md',
  'BOOTSTRAP.md',
  'sources',
  'wiki',
  'work',
  'plans',
  'runs',
  'outputs',
  'reviews',
  'schemas',
]

interface RepositoryInspectResult {
  pathExists: boolean
  isDirectory: boolean
  isGitRepo: boolean
  isEmpty: boolean
  hasRequiredTemplate: boolean
  permissionDenied: boolean
  detectedProfile?: 'default' | 'llm-wiki'
  suggestedKnowledge?: {
    sourceRoot?: string
    wikiRoot?: string
    indexPath?: string
    logPath?: string
    schemaPath?: string
    mapsRoot?: string
    assetsRoot?: string
    confidence?: 'low' | 'medium' | 'high'
    mappingSource?: 'default' | 'agent' | 'manual' | 'fallback'
  }
}

interface RepositoryMarkdownFile {
  path: string
  name: string
  size: number
  updatedAt: number
}

interface RepositorySearchResult {
  path: string
  line: number
  snippet: string
}

interface RepositoryGitLogEntry {
  hash: string
  shortHash: string
  date: string
  author: string
  subject: string
}

function templateRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'agentic-repo')
    : path.join(process.cwd(), 'resources', 'agentic-repo')
}

async function checkGitAvailable(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version'], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

function getDefaultRepositoryPath(): string {
  return path.join(app.getPath('home'), 'OpenClaw', 'Agentic Repository')
}

async function chooseDirectory(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose Agentic Repository Folder',
    defaultPath: getDefaultRepositoryPath(),
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
}

async function pathExists(repoPath: string, relativePath: string): Promise<boolean> {
  try {
    await access(await resolveSafeExistingRepoPath(repoPath, relativePath))
    return true
  } catch {
    return false
  }
}

async function detectRepositoryProfile(repoPath: string, entries: string[]): Promise<Pick<RepositoryInspectResult, 'hasRequiredTemplate' | 'detectedProfile' | 'suggestedKnowledge'>> {
  const hasDefaultTemplate = REQUIRED_TEMPLATE_ENTRIES.every((entry) => entries.includes(entry))
  if (hasDefaultTemplate) {
    return {
      hasRequiredTemplate: true,
      detectedProfile: 'default',
      suggestedKnowledge: {
        sourceRoot: 'sources',
        wikiRoot: 'wiki',
        indexPath: 'wiki/index.md',
        logPath: 'wiki/log.md',
        schemaPath: 'AGENTS.md',
        mappingSource: 'default',
      },
    }
  }

  const hasAnythingKnowledge = (
    entries.includes('AGENTS.md') &&
    entries.includes('README.md') &&
    entries.includes('30-knowledge') &&
    await pathExists(repoPath, '30-knowledge/index.md') &&
    await pathExists(repoPath, '30-knowledge/log.md') &&
    await pathExists(repoPath, '30-knowledge/wiki') &&
    await pathExists(repoPath, '30-knowledge/sources')
  )

  if (hasAnythingKnowledge) {
    return {
      hasRequiredTemplate: true,
      detectedProfile: 'llm-wiki',
      suggestedKnowledge: {
        sourceRoot: '30-knowledge/sources',
        wikiRoot: '30-knowledge/wiki',
        indexPath: '30-knowledge/index.md',
        logPath: '30-knowledge/log.md',
        schemaPath: 'AGENTS.md',
        mapsRoot: '30-knowledge/maps',
        confidence: 'medium',
        mappingSource: 'fallback',
      },
    }
  }

  return {
    hasRequiredTemplate: false,
  }
}

async function inspectRepository(repoPath: string): Promise<RepositoryInspectResult> {
  try {
    await access(repoPath)
    const info = await stat(repoPath)
    if (!info.isDirectory()) {
      return {
        pathExists: true,
        isDirectory: false,
        isGitRepo: false,
        isEmpty: false,
        hasRequiredTemplate: false,
        permissionDenied: false,
      }
    }

    const entries = await readdir(repoPath)
    const contentEntries = entries.filter((entry) => entry !== '.git' && entry !== '.DS_Store')
    const profile = await detectRepositoryProfile(repoPath, entries)

    return {
      pathExists: true,
      isDirectory: true,
      isGitRepo: entries.includes('.git'),
      isEmpty: contentEntries.length === 0,
      hasRequiredTemplate: profile.hasRequiredTemplate,
      permissionDenied: false,
      detectedProfile: profile.detectedProfile,
      suggestedKnowledge: profile.suggestedKnowledge,
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      pathExists: code !== 'ENOENT',
      isDirectory: false,
      isGitRepo: false,
      isEmpty: false,
      hasRequiredTemplate: false,
      permissionDenied: code === 'EACCES' || code === 'EPERM',
    }
  }
}

async function bootstrapRepository(repoPath: string): Promise<RepositoryInspectResult> {
  await mkdir(repoPath, { recursive: true })
  const before = await inspectRepository(repoPath)
  if (before.permissionDenied) return before

  const entries = await readdir(repoPath)
  const contentEntries = entries.filter((entry) => entry !== '.git' && entry !== '.DS_Store')
  if (contentEntries.length > 0 && !before.hasRequiredTemplate) {
    throw new Error('repository-not-empty')
  }

  if (!before.isGitRepo) {
    await execFileAsync('git', ['init'], { cwd: repoPath, timeout: 10000 })
  }

  await cp(templateRoot(), repoPath, {
    recursive: true,
    force: false,
    errorOnExist: false,
  })

  return inspectRepository(repoPath)
}

async function initRepository(repoPath: string): Promise<RepositoryInspectResult> {
  return bootstrapRepository(repoPath)
}

async function listGitVisibleTree(repoPath: string, maxEntries: number): Promise<string[] | null> {
  const root = await resolveSafeExistingRepoPath(repoPath, '.').catch(() => null)
  if (!root) return []
  try {
    const result = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    })
    const files = result.stdout
      .split('\0')
      .filter((item) => item.length > 0)
      .filter((item) => !shouldSkipTreePath(item))
      .sort((a, b) => a.localeCompare(b))
    const entries = new Set<string>()
    for (const file of files) {
      for (const parent of parentTreeEntries(file)) {
        entries.add(parent)
        if (entries.size >= maxEntries) return [...entries]
      }
      entries.add(file)
      if (entries.size >= maxEntries) return [...entries]
    }
    return [...entries]
  } catch {
    return null
  }
}

function parentTreeEntries(filePath: string): string[] {
  const parts = filePath.split('/').filter(Boolean)
  const parents: string[] = []
  for (let index = 1; index < parts.length; index += 1) {
    parents.push(`${parts.slice(0, index).join('/')}/`)
  }
  return parents
}

function shouldSkipTreePath(filePath: string): boolean {
  const parts = filePath.split('/').filter(Boolean)
  return parts.some((part) => part === '.git' || part === 'node_modules' || part === '.DS_Store')
}

async function listMarkdown(repoPath: string, directory: string): Promise<RepositoryMarkdownFile[]> {
  const root = await resolveSafeExistingRepoPath(repoPath, directory).catch(() => null)
  if (!root) return []
  const files: RepositoryMarkdownFile[] = []

  async function visit(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name === '.git') continue
      if (entry.isSymbolicLink()) continue
      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const info = await stat(fullPath)
      files.push({
        path: path.relative(path.resolve(repoPath), fullPath).split(path.sep).join('/'),
        name: entry.name,
        size: info.size,
        updatedAt: info.mtimeMs,
      })
    }
  }

  await visit(root)
  return files.sort((a, b) => a.path.localeCompare(b.path)).slice(0, 500)
}

async function listTree(repoPath: string, maxEntries = 300): Promise<string[]> {
  const gitTree = await listGitVisibleTree(repoPath, maxEntries)
  if (gitTree) return gitTree
  const root = await resolveSafeExistingRepoPath(repoPath, '.').catch(() => null)
  if (!root) return []
  const entries: string[] = []

  async function visit(currentPath: string, depth: number): Promise<void> {
    if (entries.length >= maxEntries || depth > 4) return
    const items = await readdir(currentPath, { withFileTypes: true }).catch(() => [])
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entries.length >= maxEntries) return
      if (item.name === '.git' || item.name === 'node_modules' || item.name === '.DS_Store') continue
      if (item.isSymbolicLink()) continue
      const fullPath = path.join(currentPath, item.name)
      const relativePath = path.relative(root, fullPath).split(path.sep).join('/')
      entries.push(item.isDirectory() ? `${relativePath}/` : relativePath)
      if (item.isDirectory()) await visit(fullPath, depth + 1)
    }
  }

  await visit(root, 0)
  return entries
}

async function readText(repoPath: string, relativePath: string): Promise<string> {
  try {
    return await readFile(await resolveSafeExistingRepoPath(repoPath, relativePath), 'utf-8')
  } catch {
    return ''
  }
}

async function writeText(repoPath: string, relativePath: string, content: string): Promise<void> {
  const target = await resolveSafeWritableRepoPath(repoPath, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, 'utf-8')
}

async function searchRepository(repoPath: string, query: string, directories: string[]): Promise<RepositorySearchResult[]> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []
  const files = (await Promise.all(directories.map((directory) => listMarkdown(repoPath, directory)))).flat()
  const results: RepositorySearchResult[] = []

  for (const file of files) {
    const content = await readText(repoPath, file.path)
    const lines = content.split(/\r?\n/)
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (!line.toLowerCase().includes(trimmed)) continue
      results.push({
        path: file.path,
        line: index + 1,
        snippet: line.trim().slice(0, 240),
      })
      if (results.length >= 50) return results
    }
  }

  return results
}

async function gitStatus(repoPath: string): Promise<string> {
  const result = await execFileAsync('git', ['status', '--short'], { cwd: path.resolve(repoPath), timeout: 10000 })
  return result.stdout
}

async function gitDiff(repoPath: string): Promise<string> {
  const result = await execFileAsync('git', ['diff'], { cwd: path.resolve(repoPath), timeout: 10000, maxBuffer: 1024 * 1024 })
  return result.stdout
}

async function gitLog(repoPath: string, relativePath: string, limit = 12): Promise<RepositoryGitLogEntry[]> {
  resolveRepoPath(repoPath, relativePath)
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 12, 50))
  const result = await execFileAsync('git', [
    'log',
    `--max-count=${safeLimit}`,
    '--date=short',
    '--pretty=format:%H%x1f%h%x1f%ad%x1f%an%x1f%s',
    '--',
    relativePath,
  ], {
    cwd: path.resolve(repoPath),
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  })
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash = '', shortHash = '', date = '', author = '', subject = ''] = line.split('\x1f')
      return { hash, shortHash, date, author, subject }
    })
}

async function gitCommit(repoPath: string, message: string): Promise<string> {
  const trimmed = message.trim()
  if (!trimmed) throw new Error('commit-message-required')
  await execFileAsync('git', ['add', '.'], { cwd: path.resolve(repoPath), timeout: 10000 })
  const result = await execFileAsync('git', ['commit', '-m', trimmed], {
    cwd: path.resolve(repoPath),
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  })
  return result.stdout
}

function cleanupAgentsFileWatcher(watchId: string): void {
  const entry = agentsFileWatchers.get(watchId)
  if (!entry) return
  agentsFileWatchers.delete(watchId)
  if (!entry.sender.isDestroyed()) {
    entry.sender.off('destroyed', entry.destroyedHandler)
  }
  entry.watcher.close()
}

function cleanupAgentsFileWatchersForWebContents(webContentsId: number): void {
  for (const [watchId, entry] of agentsFileWatchers.entries()) {
    if (entry.webContentsId === webContentsId) cleanupAgentsFileWatcher(watchId)
  }
}

function watchAgentsFile(sender: Electron.WebContents, repoPath: string): { watchId: string; repoPath: string } {
  const watchId = `agents_${agentsFileWatchSeq += 1}`
  const webContentsId = sender.id
  const destroyedHandler = () => {
    cleanupAgentsFileWatchersForWebContents(webContentsId)
  }
  const watcher = fs.watch(path.join(repoPath, 'AGENTS.md'), { persistent: false }, () => {
    if (sender.isDestroyed()) {
      cleanupAgentsFileWatcher(watchId)
      return
    }
    sender.send('repository:agentsFileChanged', { watchId, repoPath })
  })
  watcher.on('error', () => {
    cleanupAgentsFileWatcher(watchId)
  })
  agentsFileWatchers.set(watchId, { watcher, sender, webContentsId, repoPath, destroyedHandler })
  sender.once('destroyed', destroyedHandler)
  return { watchId, repoPath }
}

function unwatchAgentsFile(sender: Electron.WebContents, watchId: string): { ok: true } {
  const entry = agentsFileWatchers.get(watchId)
  if (entry?.webContentsId === sender.id) cleanupAgentsFileWatcher(watchId)
  return { ok: true }
}

export function registerRepositoryIpcHandlers(): void {
  ipcMain.handle('repository:checkGit', () => checkGitAvailable())
  ipcMain.handle('repository:chooseDirectory', () => chooseDirectory())
  ipcMain.handle('repository:getDefaultPath', () => getDefaultRepositoryPath())
  ipcMain.handle('repository:inspect', (_event, repoPath: string) => inspectRepository(repoPath))
  ipcMain.handle('repository:bootstrap', (_event, repoPath: string) => bootstrapRepository(repoPath))
  ipcMain.handle('repository:init', (_event, repoPath: string) => initRepository(repoPath))
  ipcMain.handle('repository:listTree', (_event, repoPath: string, maxEntries?: number) => listTree(repoPath, maxEntries))
  ipcMain.handle('repository:listMarkdown', (_event, repoPath: string, directory: string) => listMarkdown(repoPath, directory))
  ipcMain.handle('repository:readText', (_event, repoPath: string, relativePath: string) => readText(repoPath, relativePath))
  ipcMain.handle('repository:writeText', (_event, repoPath: string, relativePath: string, content: string) =>
    writeText(repoPath, relativePath, content),
  )
  ipcMain.handle('repository:search', (_event, repoPath: string, query: string, directories: string[]) =>
    searchRepository(repoPath, query, directories),
  )
  ipcMain.handle('repository:gitStatus', (_event, repoPath: string) => gitStatus(repoPath))
  ipcMain.handle('repository:gitDiff', (_event, repoPath: string) => gitDiff(repoPath))
  ipcMain.handle('repository:gitLog', (_event, repoPath: string, relativePath: string, limit?: number) => gitLog(repoPath, relativePath, limit))
  ipcMain.handle('repository:gitCommit', (_event, repoPath: string, message: string) => gitCommit(repoPath, message))
  ipcMain.handle('repository:watchAgentsFile', (event, repoPath: string) => watchAgentsFile(event.sender, repoPath))
  ipcMain.handle('repository:unwatchAgentsFile', (event, watchId: string) => unwatchAgentsFile(event.sender, watchId))
}
