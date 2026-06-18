import React, { useRef, useEffect, useCallback } from 'react'
import { petEventBus } from './events/PetEventBus'
import { renderer } from './renderer/CanvasRenderer'
import { SpriteManager } from './renderer/SpriteManager'
import { AnimationFSM } from './animation/AnimationFSM'
import { getRandomQuote } from './bubble/quotes'
import type { PetEvent } from '../lib/pet-types'

const spriteManager = new SpriteManager()
const fsm = new AnimationFSM()

export function PetApp(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const loadedRef = useRef(false)
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const mouseMovedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || loadedRef.current) return
    loadedRef.current = true

    renderer.init(canvas)

    let lastTime = 0

    const tick = (timestamp: number) => {
      const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016
      lastTime = timestamp

      fsm.update(dt)

      const state = fsm.currentState
      const sprite = spriteManager.getSprite(state)
      if (!sprite) {
        animFrameRef.current = requestAnimationFrame(tick)
        return
      }

      const transforms = fsm.getTransforms()
      renderer.setTransform(
        transforms.scaleX,
        transforms.scaleY,
        transforms.rotation,
        transforms.alpha,
        transforms.tint,
      )
      if (transforms.shakeX !== undefined) renderer.setShake(transforms.shakeX, transforms.shakeY || 0)

      renderer.clear()
      renderer.drawSprite(sprite.image, state, dt)
      renderer.drawBubbles(dt)

      animFrameRef.current = requestAnimationFrame(tick)
    }

    spriteManager
      .preload()
      .then(() => {
        animFrameRef.current = requestAnimationFrame(tick)
      })
      .catch((err) => {
        console.error('Failed to load pet sprites:', err)
      })

    const unsubEvent = petEventBus.addEventListener((event: PetEvent) => {
      fsm.handleEvent(event)
    })

    const onIpcEvent = (event: PetEvent) => {
      petEventBus.dispatch(event)
    }

    if (window.electronAPI?.pet) {
      window.electronAPI.pet.onEvent(onIpcEvent)
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      unsubEvent()
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    mouseMovedRef.current = false
    dragStartRef.current = { x: e.screenX, y: e.screenY }
    fsm.changeStateDirect('drag')
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current) return
    const dx = e.screenX - dragStartRef.current.x
    const dy = e.screenY - dragStartRef.current.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      mouseMovedRef.current = true
    }
    if (mouseMovedRef.current && window.electronAPI?.pet?.move) {
      window.electronAPI.pet.move(dx, dy)
      dragStartRef.current = { x: e.screenX, y: e.screenY }
    }
  }, [])

  const handleMouseUp = useCallback((_e: React.MouseEvent) => {
    draggingRef.current = false
    fsm.changeStateDirect('idle')

    if (!mouseMovedRef.current) {
      // 是点击，不是拖拽
      fsm.handleEvent({ type: 'agent:completed', payload: { summary: getRandomQuote().text }, timestamp: Date.now() })
    }
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  )
}
