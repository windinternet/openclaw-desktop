export type OfficeWeaponMode = 'hands' | 'toy-blaster';

export type OfficeShotEvent = 'hit' | 'downed' | 'ignored';

export interface OfficeCombatState {
  maxShield: number;
  shield: number;
  downedUntil: number | null;
  hitReaction: number;
  lastWordsCooldownUntil: number;
  lastWords: string | null;
  shieldVisibleUntil: number;
}

export interface OfficeShotResult {
  combat: OfficeCombatState;
  event: OfficeShotEvent;
  message: string | null;
}

export interface OfficeReviveResult {
  combat: OfficeCombatState;
  revived: boolean;
  message: string | null;
}

export const DEFAULT_OFFICE_SHIELD = 100;
export const TOY_BLASTER_DAMAGE = 34;
export const OFFICE_RESPAWN_MIN_MS = 6000;
export const OFFICE_RESPAWN_MAX_MS = 18000;
export const OFFICE_SHIELD_VISIBLE_MS = 2400;
export const OFFICE_LAST_WORDS_COOLDOWN_MS = 1200;

export const OFFICE_HIT_MESSAGES = [
  '护盾滋啦一下，假装很疼。',
  '玩具光束命中，办公室气氛扣一分。',
  '这一下只伤到了仪式感。',
];

export const OFFICE_LAST_WORDS = [
  '等我重启一下。',
  '缓存没了，尊严也没了。',
  '我只是进入了省电模式。',
];

export const OFFICE_RESPAWN_MESSAGES = [
  '上线，继续假装认真工作。',
  '护盾恢复，咖啡也续上了。',
  '复活完成，刚才什么都没发生。',
];

export function createOfficeCombatState(now = 0): OfficeCombatState {
  return {
    maxShield: DEFAULT_OFFICE_SHIELD,
    shield: DEFAULT_OFFICE_SHIELD,
    downedUntil: null,
    hitReaction: 0,
    lastWordsCooldownUntil: 0,
    lastWords: null,
    shieldVisibleUntil: now,
  };
}

export function applyOfficeShot(
  combat: OfficeCombatState & { downedUntil: number },
  now: number,
  random?: () => number,
): OfficeShotResult & { event: 'ignored'; message: null };
export function applyOfficeShot(
  combat: OfficeCombatState,
  now: number,
  random?: () => number,
): OfficeShotResult & { message: string };
export function applyOfficeShot(
  combat: OfficeCombatState,
  now: number,
  random = Math.random,
): OfficeShotResult {
  if (combat.downedUntil !== null) {
    return {
      combat,
      event: 'ignored',
      message: null,
    };
  }

  const nextShield = Math.max(0, combat.shield - TOY_BLASTER_DAMAGE);
  const shieldVisibleUntil = now + OFFICE_SHIELD_VISIBLE_MS;

  if (nextShield <= 0) {
    const respawnDelay = randomBetween(OFFICE_RESPAWN_MIN_MS, OFFICE_RESPAWN_MAX_MS, random);
    const message = pickRandom(OFFICE_LAST_WORDS, random);

    return {
      combat: {
        ...combat,
        shield: 0,
        downedUntil: now + respawnDelay,
        hitReaction: 1,
        lastWordsCooldownUntil: now + OFFICE_LAST_WORDS_COOLDOWN_MS,
        lastWords: message,
        shieldVisibleUntil,
      },
      event: 'downed',
      message,
    };
  }

  const message = now >= combat.lastWordsCooldownUntil ? pickRandom(OFFICE_HIT_MESSAGES, random) : null;

  return {
    combat: {
      ...combat,
      shield: nextShield,
      hitReaction: 1,
      lastWordsCooldownUntil: now + OFFICE_LAST_WORDS_COOLDOWN_MS,
      shieldVisibleUntil,
    },
    event: 'hit',
    message,
  };
}

export function reviveOfficeCombatIfReady(
  combat: OfficeCombatState & { downedUntil: null },
  now: number,
  random?: () => number,
): OfficeReviveResult & { revived: false; message: null };
export function reviveOfficeCombatIfReady(
  combat: OfficeCombatState & { downedUntil: number },
  now: number,
  random?: () => number,
): OfficeReviveResult & { message: string };
export function reviveOfficeCombatIfReady(
  combat: OfficeCombatState,
  now: number,
  random = Math.random,
): OfficeReviveResult {
  if (combat.downedUntil === null || now < combat.downedUntil) {
    return {
      combat,
      revived: false,
      message: null,
    };
  }

  return {
    combat: {
      ...combat,
      shield: combat.maxShield,
      downedUntil: null,
      hitReaction: 0,
      lastWordsCooldownUntil: now + OFFICE_LAST_WORDS_COOLDOWN_MS,
      lastWords: null,
      shieldVisibleUntil: now + OFFICE_SHIELD_VISIBLE_MS,
    },
    revived: true,
    message: pickRandom(OFFICE_RESPAWN_MESSAGES, random),
  };
}

export function officeShieldRatio(combat: OfficeCombatState): number {
  if (combat.maxShield <= 0) {
    return 0;
  }

  return clamp(combat.shield / combat.maxShield, 0, 1);
}

function randomBetween(min: number, max: number, random: () => number): number {
  return min + (max - min) * clamp(random(), 0, 1);
}

function pickRandom(messages: readonly string[], random: () => number): string {
  const index = Math.min(messages.length - 1, Math.floor(clamp(random(), 0, 0.999999) * messages.length));
  return messages[index];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
