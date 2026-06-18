import type { PetEvent, PetAnimationState } from '../../lib/pet-types';

type EventListener = (event: PetEvent) => void;
type StateListener = (state: PetAnimationState) => void;

class _PetEventBus {
  private eventListeners = new Set<EventListener>();
  private stateListeners = new Set<StateListener>();
  private _stateQueue: PetEvent[] = [];

  addEventListener(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    if (this._stateQueue.length > 0) {
      this._stateQueue.forEach((e) => fn(e));
      this._stateQueue = [];
    }
    return () => this.eventListeners.delete(fn);
  }

  dispatch(event: PetEvent): void {
    if (this.eventListeners.size === 0) {
      this._stateQueue.push(event);
      if (this._stateQueue.length > 50) this._stateQueue.shift();
      return;
    }
    this.eventListeners.forEach((fn) => fn(event));
  }

  onStateChange(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  emitState(state: PetAnimationState): void {
    this.stateListeners.forEach((fn) => fn(state));
  }

  clearQueue(): void {
    this._stateQueue = [];
  }
}

export const petEventBus = new _PetEventBus();
