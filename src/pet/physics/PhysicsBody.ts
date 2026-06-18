interface Vec2 {
  x: number
  y: number
}

export class PhysicsBody {
  position: Vec2
  velocity: Vec2
  target: Vec2
  damping: number
  elastic: number

  constructor(x = 0, y = 0) {
    this.position = { x, y }
    this.velocity = { x: 0, y: 0 }
    this.target = { x, y }
    this.damping = 0.92
    this.elastic = 0.5
  }

  setTarget(tx: number, ty: number): void {
    this.target = { x: tx, y: ty }
  }

  update(dt: number): void {
    const speed = 300
    const maxForce = speed * dt

    const dx = this.target.x - this.position.x
    const dy = this.target.y - this.position.y
    if (Math.abs(dx) > 1) {
      this.velocity.x += Math.sign(dx) * Math.min(maxForce, Math.abs(dx)) * 3
    }
    if (Math.abs(dy) > 1) {
      this.velocity.y += Math.sign(dy) * Math.min(maxForce, Math.abs(dy)) * 3
    }

    this.velocity.x *= this.damping
    this.velocity.y *= this.damping

    if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0
    if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0

    this.position.x += this.velocity.x * dt
    this.position.y += this.velocity.y * dt
  }
}
