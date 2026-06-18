import type { PetEvent, PetAnimationState } from '../../lib/pet-types';

export interface PetTransforms {
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  tint: string | null;
  shakeX: number;
  shakeY: number;
}

export class AnimationFSM {
  currentState: PetAnimationState = 'idle';

  update(_dt: number): void {
    /* Animation FSM update logic - implemented in animation tasks */
  }

  handleEvent(_event: PetEvent): void {
    /* Event-driven state transitions - implemented in animation tasks */
  }

  getTransforms(): PetTransforms {
    return {
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      alpha: 1,
      tint: null,
      shakeX: 0,
      shakeY: 0,
    };
  }
}
