import { getRandomQuote } from './quotes'

interface Bubble {
  text: string
  timeLeft: number
}

export class BubbleSystem {
  private active: Bubble | null = null

  show(text?: string): void {
    this.active = {
      text: text ?? getRandomQuote().text,
      timeLeft: 3,
    }
  }

  hide(): void {
    this.active = null
  }

  isVisible(): boolean {
    return this.active !== null && this.active.timeLeft > 0
  }

  getText(): string | null {
    return this.active?.text ?? null
  }

  getOpacity(): number {
    if (!this.active || this.active.timeLeft <= 0) return 0
    if (this.active.timeLeft < 1) return this.active.timeLeft
    return 1
  }

  update(dt: number): void {
    if (this.active) {
      this.active.timeLeft -= dt
      if (this.active.timeLeft <= 0) {
        this.active = null
      }
    }
  }
}
