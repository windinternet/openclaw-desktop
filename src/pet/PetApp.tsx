import React, { useRef, useEffect, useCallback } from 'react';
import { petEventBus } from './events/PetEventBus';
import { renderer } from './renderer/CanvasRenderer';
import { SpriteManager } from './renderer/SpriteManager';
import { AnimationFSM } from './animation/AnimationFSM';
import { getRandomQuote } from './bubble/quotes';
import type { PetEvent } from '../lib/pet-types';

const spriteManager = new SpriteManager();
const fsm = new AnimationFSM();

export function PetApp(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadedRef.current) return;
    loadedRef.current = true;

    renderer.init(canvas);

    let lastTime = 0;

    const tick = (timestamp: number) => {
      const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
      lastTime = timestamp;

      fsm.update(dt);

      const state = fsm.currentState;
      const sprite = spriteManager.getSprite(state);
      if (!sprite) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const transforms = fsm.getTransforms();
      renderer.setTransform(
        transforms.scaleX,
        transforms.scaleY,
        transforms.rotation,
        transforms.alpha,
        transforms.tint,
      );
      if (transforms.shakeX !== undefined) renderer.setShake(transforms.shakeX, transforms.shakeY || 0);

      renderer.clear();
      renderer.drawSprite(sprite.image, state, dt);
      renderer.drawBubbles(dt);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    spriteManager
      .preload()
      .then(() => {
        animFrameRef.current = requestAnimationFrame(tick);
      })
      .catch((err) => {
        console.error('Failed to load pet sprites:', err);
      });

    const unsubEvent = petEventBus.addEventListener((event: PetEvent) => {
      fsm.handleEvent(event);
    });

    const onIpcEvent = (event: PetEvent) => {
      petEventBus.dispatch(event);
    };

    let unsubIpcEvent: (() => void) | undefined;

    if (window.electronAPI?.pet) {
      unsubIpcEvent = window.electronAPI.pet.onEvent(onIpcEvent);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      unsubEvent();
      unsubIpcEvent?.();
      loadedRef.current = false;
    };
  }, []);

  const handleCanvasClick = useCallback(() => {
    const quote = getRandomQuote();
    renderer.addBubble(quote.text, 0, -10);
    if (quote.emoji) {
      renderer.addEmojiBubble(quote.emoji, 20, -30);
    }
    fsm.handleEvent({
      type: 'agent:completed',
      payload: { summary: quote.text },
      timestamp: Date.now(),
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <canvas
        ref={canvasRef}
        style={
          {
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties
        }
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
