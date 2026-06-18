/** 宠物事件类型 */
export type PetEventType =
  | 'connection:connected'
  | 'connection:connecting'
  | 'connection:error'
  | 'connection:disconnected'
  | 'agent:streaming'
  | 'agent:completed'
  | 'agent:error'
  | 'agent:tool-call'
  | 'notification:unread';

/** 宠物窗口接收的事件 */
export interface PetEvent {
  type: PetEventType;
  payload?: {
    summary?: string;
    errorMessage?: string;
    toolName?: string;
    notificationCount?: number;
  };
  timestamp: number;
}

/** 宠物动画状态 */
export type PetAnimationState =
  | 'idle'
  | 'walk'
  | 'hop'
  | 'drag'
  | 'react'
  | 'sit'
  | 'sleep';

/** 宠物持久化状态 */
export interface PetPersistedState {
  enabled: boolean;
  size: number;
  x: number;
  y: number;
  aiLinkEnabled: boolean;
}

/** 宠物默认配置 */
export const PET_DEFAULTS: PetPersistedState = {
  enabled: false,
  size: 1,
  x: -1, // -1 表示使用默认右下角
  y: -1,
  aiLinkEnabled: true,
};

/** 宠物窗口尺寸基准（1x） */
export const PET_BASE_SIZE = { width: 200, height: 200 };

/** 状态超时配置（毫秒） */
export const PET_TIMEOUTS = {
  idleToWalk: 30_000,
  idleToSit: 60_000,
  sitToSleep: 120_000,
  sleepDeepFps: 300_000, // 5 分钟后降帧
} as const;

/** 俏皮话类型 */
export interface PetQuote {
  text: string;
  emoji?: string;
  weight: number; // 权重，决定随机出现概率
}
