import type { PetEvent, PetPersistedState } from './pet-types'

function getPet() {
  if (typeof window === 'undefined') return undefined
  return window.electronAPI?.pet
}

/** 向宠物窗口发送 Gateway 事件 */
export function emitPetEvent(event: PetEvent): void {
  const pet = getPet()
  if (!pet) return
  pet.emitEvent(event).catch(() => {
    /* 宠物窗口不存在时忽略 */
  })
}

/** 获取宠物持久化状态 */
export async function getPetState(): Promise<PetPersistedState | null> {
  const pet = getPet()
  if (!pet) return null
  try {
    return await pet.getState()
  } catch {
    return null
  }
}

/** 设置宠物大小 */
export async function setPetSize(scale: number): Promise<void> {
  const pet = getPet()
  if (!pet) return
  await pet.setSize(scale)
}

/** 设置 AI 联动开关 */
export async function setPetAiLink(enabled: boolean): Promise<void> {
  const pet = getPet()
  if (!pet) return
  await pet.setAiLink(enabled)
}

/** 切换宠物显示 */
export async function togglePet(): Promise<boolean> {
  const pet = getPet()
  if (!pet) return false
  return await pet.toggle()
}
