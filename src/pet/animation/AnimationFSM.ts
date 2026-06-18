import type { PetAnimationState, PetEvent } from '../../lib/pet-types'
import { shouldTransition } from './transitions'
import { renderer } from '../renderer/CanvasRenderer'
import { petEventBus } from '../events/PetEventBus'

export interface TransformState {
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
  tint: string | null
  shakeX?: number
  shakeY?: number
}

export class AnimationFSM {
  currentState: PetAnimationState = 'idle'
  private stateEnterTime = Date.now()
  private lastInteractionTime = Date.now()
  private previousState: PetAnimationState = 'idle'
  private reactTimer = 0
  private hopTimer = 0

  update(dt: number): void {
    const now = Date.now()

    if (this.currentState === 'react') {
      this.reactTimer -= dt
      if (this.reactTimer <= 0) {
        this.changeState(this.previousState === 'react' ? 'idle' : this.previousState)
      }
    }

    if (this.currentState === 'hop') {
      this.hopTimer -= dt
      if (this.hopTimer <= 0) {
        this.changeState(this.previousState === 'hop' ? 'idle' : this.previousState)
      }
    }

    if (this.currentState !== 'drag' && this.currentState !== 'react' && this.currentState !== 'hop') {
      const next = shouldTransition(
        { currentState: this.currentState, stateEnterTime: this.stateEnterTime, lastInteractionTime: this.lastInteractionTime },
        now,
      )
      if (next) {
        this.changeState(next)
      }
    }
  }

  handleEvent(event: PetEvent): void {
    this.lastInteractionTime = Date.now()

    switch (event.type) {
      case 'connection:connected':
        this.changeState('react')
        this.reactTimer = 2.5
        renderer.addBubble('连接成功！', 0, -60)
        renderer.addEmojiBubble('💚', 40, -40)
        break

      case 'connection:connecting':
        this.changeState('react')
        this.reactTimer = 2
        renderer.addBubble('正在连接...', 0, -60)
        break

      case 'connection:error':
      case 'connection:disconnected':
        this.changeState('react')
        this.reactTimer = 2.5
        renderer.addBubble(event.payload?.errorMessage || '连接断开', 0, -60)
        renderer.addEmojiBubble('❌', 0, -40)
        break

      case 'agent:streaming':
        this.changeState('react')
        this.reactTimer = 0
        break

      case 'agent:completed':
        this.changeState('react')
        this.reactTimer = 3
        renderer.addBubble(event.payload?.summary || '回复完成', 0, -60)
        renderer.addEmojiBubble('✅', 30, -40)
        break

      case 'agent:error':
        this.changeState('react')
        this.reactTimer = 2.5
        renderer.addBubble(event.payload?.errorMessage || '出错了', 0, -60)
        renderer.addEmojiBubble('⚠️', 0, -40)
        break

      case 'agent:tool-call':
        this.changeState('react')
        this.reactTimer = 2
        renderer.addEmojiBubble('🔧', 0, -40)
        break

      case 'notification:unread':
        this.changeState('react')
        this.reactTimer = 3
        renderer.addEmojiBubble('📬', 0, -50)
        break
    }
  }

  getTransforms(): TransformState {
    const now = Date.now()
    switch (this.currentState) {
      case 'idle': {
        const breathe = 1 + Math.sin(now / 800) * 0.04
        return { scaleX: breathe, scaleY: breathe, rotation: 0, alpha: 1, tint: null }
      }
      case 'walk': {
        const wobble = Math.sin(now / 200) * 0.03
        return { scaleX: 1, scaleY: 1, rotation: wobble, alpha: 1, tint: null }
      }
      case 'hop': {
        const elapsed = 0.3 - this.hopTimer
        const hopY = -Math.sin(elapsed * Math.PI) * 5
        const squash = 1 + Math.cos(elapsed * Math.PI * 2) * 0.1
        return { scaleX: 1 + (1 - squash), scaleY: squash, rotation: 0, alpha: 1, tint: null, shakeY: hopY }
      }
      case 'drag': {
        return { scaleX: 1.05, scaleY: 0.95, rotation: 0, alpha: 0.9, tint: null }
      }
      case 'react': {
        const pulse = 1 + Math.sin(now / 150) * 0.03
        return { scaleX: pulse, scaleY: pulse, rotation: 0, alpha: 1, tint: null }
      }
      case 'sit': {
        return { scaleX: 1, scaleY: 0.85, rotation: 0, alpha: 1, tint: null }
      }
      case 'sleep': {
        const sway = Math.sin(now / 2000) * 0.03
        return { scaleX: 1, scaleY: 1, rotation: sway, alpha: 0.8, tint: null }
      }
      default:
        return { scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, tint: null }
    }
  }

  changeStateDirect(newState: PetAnimationState): void {
    if (this.currentState === newState) return
    this.currentState = newState
    this.stateEnterTime = Date.now()
    petEventBus.emitState(newState)
  }

  private changeState(newState: PetAnimationState): void {
    if (this.currentState === newState) return
    if (this.currentState !== 'react' && this.currentState !== 'hop') {
      this.previousState = this.currentState
    }
    this.currentState = newState
    this.stateEnterTime = Date.now()
    petEventBus.emitState(newState)
  }
}
