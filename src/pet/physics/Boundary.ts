export interface ScreenBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export function getScreenBounds(): ScreenBounds {
  return {
    left: 0,
    top: 0,
    right: window.screen.availWidth,
    bottom: 600,
  }
}

export function clampToScreen(
  x: number,
  y: number,
  petWidth: number,
  petHeight: number,
): { x: number, y: number, bounced: boolean } {
  const bounds = getScreenBounds()
  let bounced = false

  if (x < bounds.left) {
    x = bounds.left
    bounced = true
  }
  if (y < bounds.top) {
    y = bounds.top
    bounced = true
  }
  if (x + petWidth > bounds.right) {
    x = bounds.right - petWidth
    bounced = true
  }
  if (y + petHeight > bounds.bottom) {
    y = bounds.bottom - petHeight
    bounced = true
  }

  return { x, y, bounced }
}
