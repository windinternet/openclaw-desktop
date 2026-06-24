import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  DEFAULT_OFFICE_SHIELD,
  OFFICE_LAST_WORDS_COOLDOWN_MS,
  OFFICE_RESPAWN_MAX_MS,
  OFFICE_RESPAWN_MIN_MS,
  OFFICE_SHIELD_VISIBLE_MS,
  TOY_BLASTER_DAMAGE,
  type OfficeReviveResult,
  type OfficeShotResult,
  applyOfficeShot,
  createOfficeCombatState,
  officeShieldRatio,
  reviveOfficeCombatIfReady,
} from '../lib/office-gameplay';

describe('office gameplay rules', () => {
  it('creates targets with a full default shield', () => {
    const combat = createOfficeCombatState(1000);

    expect(combat.maxShield).toBe(DEFAULT_OFFICE_SHIELD);
    expect(combat.shield).toBe(DEFAULT_OFFICE_SHIELD);
    expect(combat.downedUntil).toBeNull();
    expect(combat.hitReaction).toBe(0);
    expect(combat.lastWords).toBeNull();
    expect(combat.lastWordsCooldownUntil).toBe(0);
    expect(combat.shieldVisibleUntil).toBe(1000);
  });

  it('subtracts toy blaster damage without downing a healthy target', () => {
    const result = applyOfficeShot(createOfficeCombatState(1000), 1200, () => 0.25);
    expectTypeOf(result).toEqualTypeOf<OfficeShotResult>();

    expect(result.event).toBe('hit');
    expect(result.combat.shield).toBe(DEFAULT_OFFICE_SHIELD - TOY_BLASTER_DAMAGE);
    expect(result.combat.downedUntil).toBeNull();
    expect(result.combat.hitReaction).toBe(1);
    expect(result.combat.shieldVisibleUntil).toBe(1200 + OFFICE_SHIELD_VISIBLE_MS);
    expect(result.combat.lastWordsCooldownUntil).toBe(1200 + OFFICE_LAST_WORDS_COOLDOWN_MS);
    expect(result.message).not.toBeNull();
    if (result.message === null) {
      throw new Error('expected a hit message');
    }
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('allows hit messages to be absent while message cooldown is active', () => {
    const combat = {
      ...createOfficeCombatState(1000),
      lastWordsCooldownUntil: 5000,
    };

    const result = applyOfficeShot(combat, 1200, () => 0.25);
    expectTypeOf(result).toEqualTypeOf<OfficeShotResult>();

    expect(result.event).toBe('hit');
    expect(result.message).toBeNull();
    expect(result.combat.shieldVisibleUntil).toBe(1200 + OFFICE_SHIELD_VISIBLE_MS);
    expect(result.combat.lastWordsCooldownUntil).toBe(1200 + OFFICE_LAST_WORDS_COOLDOWN_MS);
  });

  it('downs the target and schedules a respawn inside the allowed window', () => {
    let combat = createOfficeCombatState(1000);
    combat = { ...combat, shield: 20 };

    const result = applyOfficeShot(combat, 2000, () => 0.5);
    expectTypeOf(result).toEqualTypeOf<OfficeShotResult>();

    expect(result.event).toBe('downed');
    expect(result.combat.shield).toBe(0);
    expect(result.combat.downedUntil).not.toBeNull();
    expect(result.combat.downedUntil).toBeGreaterThanOrEqual(2000 + OFFICE_RESPAWN_MIN_MS);
    expect(result.combat.downedUntil).toBeLessThanOrEqual(2000 + OFFICE_RESPAWN_MAX_MS);
    expect(result.combat.lastWords).toBe(result.message);
    expect(result.combat.shieldVisibleUntil).toBe(2000 + OFFICE_SHIELD_VISIBLE_MS);
    expect(result.combat.lastWordsCooldownUntil).toBe(2000 + OFFICE_LAST_WORDS_COOLDOWN_MS);
  });

  it('ignores repeated shots while the target is downed', () => {
    const downed = {
      ...createOfficeCombatState(1000),
      shield: 0,
      downedUntil: 10000,
      lastWords: '等我重启一下。',
    };

    const result = applyOfficeShot(downed, 3000, () => 0.1);
    expectTypeOf(result).toEqualTypeOf<OfficeShotResult>();

    expect(result.event).toBe('ignored');
    expect(result.combat).toEqual(downed);
    expect(result.message).toBeNull();
  });

  it('revives a downed target at the scheduled time', () => {
    const downed = {
      ...createOfficeCombatState(1000),
      shield: 0,
      downedUntil: 7000,
      lastWords: '缓存没了，尊严也没了。',
      hitReaction: 0.4,
    };

    const early = reviveOfficeCombatIfReady(downed, 6999, () => 0.2);
    expectTypeOf(early).toEqualTypeOf<OfficeReviveResult>();
    expect(early.revived).toBe(false);
    expect(early.combat).toEqual(downed);
    expect(early.message).toBeNull();

    const revived = reviveOfficeCombatIfReady(downed, 7000, () => 0.2);
    expectTypeOf(revived).toEqualTypeOf<OfficeReviveResult>();
    expect(revived.revived).toBe(true);
    expect(revived.combat.shield).toBe(DEFAULT_OFFICE_SHIELD);
    expect(revived.combat.downedUntil).toBeNull();
    expect(revived.combat.lastWords).toBeNull();
    expect(revived.combat.shieldVisibleUntil).toBe(7000 + OFFICE_SHIELD_VISIBLE_MS);
    expect(revived.combat.lastWordsCooldownUntil).toBe(7000 + OFFICE_LAST_WORDS_COOLDOWN_MS);
    expect(revived.message).not.toBeNull();
    if (revived.message === null) {
      throw new Error('expected a respawn message');
    }
    expect(revived.message.length).toBeGreaterThan(0);
  });

  it('uses deterministic random selection when a random function is injected', () => {
    const random = vi.fn(() => 0);

    const result = applyOfficeShot({ ...createOfficeCombatState(0), shield: 1 }, 100, random);

    expect(random).toHaveBeenCalled();
    expect(result.event).toBe('downed');
    expect(result.combat.downedUntil).toBe(100 + OFFICE_RESPAWN_MIN_MS);
  });

  it('clamps the office shield ratio between zero and one', () => {
    expect(officeShieldRatio({ ...createOfficeCombatState(), shield: 50 })).toBe(0.5);
    expect(officeShieldRatio({ ...createOfficeCombatState(), shield: -10 })).toBe(0);
    expect(officeShieldRatio({ ...createOfficeCombatState(), shield: 140 })).toBe(1);
    expect(officeShieldRatio({ ...createOfficeCombatState(), maxShield: 0, shield: 50 })).toBe(0);
  });
});
