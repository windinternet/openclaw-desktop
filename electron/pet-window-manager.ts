import { BrowserWindow, screen, app } from 'electron';
import path from 'node:path';
import { PET_BASE_SIZE } from '../src/lib/pet-types';
import { loadPetState, savePetState } from './pet-store';

let petWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

export function getPetWindow(): BrowserWindow | null {
  return petWindow;
}

function computeDefaultPosition(): { x: number; y: number } {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.workAreaSize;
  return {
    x: width - PET_BASE_SIZE.width - 20,
    y: height - PET_BASE_SIZE.height - 40,
  };
}

export function createPetWindow(): BrowserWindow {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.show();
    petWindow.focus();
    return petWindow;
  }

  const state = loadPetState();
  const size = Math.round(PET_BASE_SIZE.width * state.size);
  let x = state.x;
  let y = state.y;
  if (x < 0 || y < 0) {
    const def = computeDefaultPosition();
    x = def.x;
    y = def.y;
  }

  petWindow = new BrowserWindow({
    width: size,
    height: size,
    x,
    y,
    transparent: true,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWindow.setIgnoreMouseEvents(false);

  petWindow.on('moved', () => {
    if (!petWindow) return;
    const [wx, wy] = petWindow.getPosition();
    savePetState({ x: wx, y: wy });
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  if (isDev) {
    petWindow.loadURL('http://localhost:5173/pet.html');
  } else {
    petWindow.loadFile(path.join(__dirname, '../dist/pet.html'));
  }

  return petWindow;
}

export function destroyPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.close();
    petWindow = null;
  }
  savePetState({ enabled: false });
}

export function togglePetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    destroyPetWindow();
  } else {
    createPetWindow();
  }
}

export function setPetSize(scale: number): void {
  const state = loadPetState();
  state.size = scale;
  savePetState({ size: scale });

  if (petWindow && !petWindow.isDestroyed()) {
    const newSize = Math.round(PET_BASE_SIZE.width * scale);
    petWindow.setSize(newSize, newSize);
  }
}
