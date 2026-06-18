import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PET_DEFAULTS, type PetPersistedState } from '../src/lib/pet-types';

function petStatePath(): string {
  const userData = app.getPath('userData');
  return path.join(userData, 'pet-state.json');
}

export function loadPetState(): PetPersistedState {
  const filePath = petStatePath();
  try {
    if (!existsSync(filePath)) return { ...PET_DEFAULTS };
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...PET_DEFAULTS, ...parsed };
  } catch {
    return { ...PET_DEFAULTS };
  }
}

export function savePetState(patch: Partial<PetPersistedState>): void {
  const filePath = petStatePath();
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const current = loadPetState();
  const updated = { ...current, ...patch };
  writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
}
