import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { getPetWindow, togglePetWindow, setPetSize } from './pet-window-manager'
import { loadPetState, savePetState } from './pet-store'
import type { PetEvent } from '../src/lib/pet-types'

export function registerPetIpcHandlers(): void {
  ipcMain.handle('pet:emit-event', (_event: IpcMainInvokeEvent, petEvent: PetEvent) => {
    const state = loadPetState()
    if (!state.aiLinkEnabled) return
    const win = getPetWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('pet:event', petEvent)
    }
  })

  ipcMain.handle('pet:get-state', () => {
    return loadPetState()
  })

  ipcMain.handle('pet:set-size', (_event: IpcMainInvokeEvent, scale: number) => {
    setPetSize(scale)
  })

  ipcMain.handle('pet:set-ai-link', (_event: IpcMainInvokeEvent, enabled: boolean) => {
    savePetState({ aiLinkEnabled: enabled })
    const win = getPetWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('pet:ai-link-changed', enabled)
    }
  })

  ipcMain.handle('pet:toggle', () => {
    togglePetWindow()
    const win = getPetWindow()
    const visible = win !== null
    savePetState({ enabled: visible })
    return visible
  })

  ipcMain.handle('pet:move', (_event: IpcMainInvokeEvent, delta: { dx: number; dy: number }) => {
    const win = getPetWindow()
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition()
      win.setPosition(x + delta.dx, y + delta.dy)
    }
  })
}
