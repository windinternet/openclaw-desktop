import mascot256 from '../assets/mascot-transparent-256.png';
import appIcon256 from '../assets/app-icon-256.png';
import type { PetAnimationState } from '../../lib/pet-types';

export interface SpriteSheet {
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameDuration: number;
}

const SPRITE_MAP: Partial<Record<PetAnimationState, SpriteSheet>> = {};

export class SpriteManager {
  private loaded = false;

  async preload(): Promise<void> {
    if (this.loaded) return;

    const baseImage = new Image();
    await new Promise<void>((resolve, reject) => {
      baseImage.src = mascot256;
      baseImage.onload = () => resolve();
      baseImage.onerror = () => {
        baseImage.src = appIcon256;
        baseImage.onload = () => resolve();
        baseImage.onerror = () => reject(new Error('Failed to load pet sprite'));
      };
    });

    const sprite: SpriteSheet = {
      image: baseImage,
      frameWidth: baseImage.naturalWidth,
      frameHeight: baseImage.naturalHeight,
      frameCount: 1,
      frameDuration: 200,
    };

    const states: PetAnimationState[] = ['idle', 'walk', 'hop', 'drag', 'react', 'sit', 'sleep'];
    for (const state of states) {
      SPRITE_MAP[state] = sprite;
    }

    this.loaded = true;
  }

  getSprite(state: PetAnimationState): SpriteSheet | null {
    return SPRITE_MAP[state] ?? null;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}
