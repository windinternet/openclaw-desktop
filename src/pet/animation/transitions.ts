import type { PetAnimationState } from '../../lib/pet-types'
import { PET_TIMEOUTS } from '../../lib/pet-types'

export interface TransitionContext {
  currentState: PetAnimationState
  stateEnterTime: number
  lastInteractionTime: number
}

export function shouldTransition(ctx: TransitionContext, now: number): PetAnimationState | null {
  const timeSinceInteraction = now - ctx.lastInteractionTime

  if ((ctx.currentState === 'idle' || ctx.currentState === 'walk') && timeSinceInteraction > PET_TIMEOUTS.idleToSit) {
    return 'sit'
  }

  if (ctx.currentState === 'sit' && timeSinceInteraction > PET_TIMEOUTS.sitToSleep) {
    return 'sleep'
  }

  if ((ctx.currentState === 'sleep' || ctx.currentState === 'sit') && timeSinceInteraction < 1) {
    return 'idle'
  }

  return null
}
