interface BubbleItem {
  x: number;
  y: number;
  text: string;
  alpha: number;
  vy: number;
  life: number;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private bubbles: BubbleItem[] = [];
  private shakeX = 0;
  private shakeY = 0;
  private scaleX = 1;
  private scaleY = 1;
  private rotation = 0;
  private alpha = 1;
  private tint: string | null = null;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  clear(): void {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
  }

  setTransform(scaleX: number, scaleY: number, rotation: number, alpha: number, tint?: string | null): void {
    this.scaleX = scaleX;
    this.scaleY = scaleY;
    this.rotation = rotation;
    this.alpha = alpha;
    this.tint = tint ?? null;
  }

  drawSprite(image: HTMLImageElement, _state: string, _dt: number): void {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    // 将宠物画在画布下半部分，上方留出气泡空间
    const cx = rect.width / 2;
    const cy = rect.height * 0.55;
    const baseSize = Math.min(rect.width, rect.height) * 0.6;

    this.ctx.save();
    this.ctx.globalAlpha = this.alpha;
    this.ctx.translate(cx + this.shakeX, cy + this.shakeY);
    this.ctx.scale(this.scaleX, this.scaleY);
    this.ctx.rotate(this.rotation);

    const img = image;
    const targetW = baseSize;
    const targetH = baseSize * (img.naturalHeight / img.naturalWidth || 1);
    this.ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);

    if (this.tint) {
      this.ctx.globalCompositeOperation = 'source-atop';
      this.ctx.fillStyle = this.tint;
      this.ctx.fillRect(-targetW / 2, -targetH / 2, targetW, targetH);
    }

    this.ctx.restore();
  }

  drawBubbles(dt: number): void {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y += b.vy * (dt || 0.016);
      b.life -= dt || 0.016;
      b.alpha = Math.max(0, Math.min(1, b.life / 1.5));

      this.ctx.save();
      this.ctx.globalAlpha = b.alpha;
      this.ctx.font = '14px system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#333333';
      this.ctx.lineWidth = 1.5;
      // b.x/b.y 是相对宠物头顶的偏移，画在画布上半区域
      this.ctx.strokeText(b.text, rect.width / 2 + b.x, rect.height * 0.25 + b.y);
      this.ctx.fillText(b.text, rect.width / 2 + b.x, rect.height * 0.25 + b.y);
      this.ctx.restore();

      if (b.life <= 0) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  addBubble(text: string, x: number, y: number): void {
    this.bubbles.push({ x, y, text, alpha: 1, vy: -30, life: 3 });
    if (this.bubbles.length > 10) {
      this.bubbles.shift();
    }
  }

  addEmojiBubble(emoji: string, x: number, y: number): void {
    this.bubbles.push({ x, y, text: emoji, alpha: 1, vy: -40, life: 2 });
  }

  setShake(dx: number, dy: number): void {
    this.shakeX = dx;
    this.shakeY = dy;
  }
}

export const renderer = new CanvasRenderer();
