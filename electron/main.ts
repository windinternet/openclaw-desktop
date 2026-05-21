import { app, BrowserWindow, ipcMain, net } from 'electron'
import path from 'node:path'

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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

ipcMain.handle('discover:scan', async () => {
  const ports = [3000, 3001, 3456, 4000, 5173, 8080, 8088, 9000, 11434]
  const results: { url: string; name?: string; version?: string }[] = []

  const checks = ports
    .filter((p) => p !== 5173) // skip Vite dev server
    .map(async (port) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      try {
        const url = `http://localhost:${port}`
        const res = await net.fetch(`${url}/api/health`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({})) as any
          results.push({
            url,
            name: data.name || data.service,
            version: data.version,
          })
        }
      } catch {
        // port unreachable or timed out – skip
      } finally {
        clearTimeout(timeout)
      }
    })

  await Promise.allSettled(checks)
  return results
})

ipcMain.handle('config:getPath', () => {
  return app.getPath('userData')
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
