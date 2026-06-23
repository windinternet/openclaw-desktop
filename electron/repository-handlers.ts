import { app, ipcMain } from 'electron'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, cp, mkdir, readdir, stat } from 'node:fs/promises'

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

export function registerRepositoryIpcHandlers(): void {
  ipcMain.handle('repository:checkGit', () => checkGitAvailable())
  ipcMain.handle('repository:inspect', (_event, repoPath: string) => inspectRepository(repoPath))
  ipcMain.handle('repository:bootstrap', (_event, repoPath: string) => bootstrapRepository(repoPath))
}

