import { app, ipcMain } from 'electron'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'

const execFileAsync = promisify(execFile)

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

    return {
      pathExists: true,
      isDirectory: true,
      isGitRepo: entries.includes('.git'),
      isEmpty: contentEntries.length === 0,
      hasRequiredTemplate: REQUIRED_TEMPLATE_ENTRIES.every((entry) => entries.includes(entry)),
      permissionDenied: false,
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

function resolveRepoPath(repoPath: string, relativePath: string): string {
  const root = path.resolve(repoPath)
  const target = path.resolve(root, relativePath)
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('path-outside-repository')
  }
  return target
}

async function listMarkdown(repoPath: string, directory: string): Promise<RepositoryMarkdownFile[]> {
  const root = resolveRepoPath(repoPath, directory)
  const files: RepositoryMarkdownFile[] = []

  async function visit(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name === '.git') continue
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

async function readText(repoPath: string, relativePath: string): Promise<string> {
  return readFile(resolveRepoPath(repoPath, relativePath), 'utf-8').catch(() => '')
}

async function writeText(repoPath: string, relativePath: string, content: string): Promise<void> {
  const target = resolveRepoPath(repoPath, relativePath)
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

export function registerRepositoryIpcHandlers(): void {
  ipcMain.handle('repository:checkGit', () => checkGitAvailable())
  ipcMain.handle('repository:inspect', (_event, repoPath: string) => inspectRepository(repoPath))
  ipcMain.handle('repository:bootstrap', (_event, repoPath: string) => bootstrapRepository(repoPath))
  ipcMain.handle('repository:listMarkdown', (_event, repoPath: string, directory: string) => listMarkdown(repoPath, directory))
  ipcMain.handle('repository:readText', (_event, repoPath: string, relativePath: string) => readText(repoPath, relativePath))
  ipcMain.handle('repository:writeText', (_event, repoPath: string, relativePath: string, content: string) =>
    writeText(repoPath, relativePath, content),
  )
  ipcMain.handle('repository:search', (_event, repoPath: string, query: string, directories: string[]) =>
    searchRepository(repoPath, query, directories),
  )
}
