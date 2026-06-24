import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OFFICE_SHIELD,
  OFFICE_RESPAWN_MAX_MS,
  OFFICE_RESPAWN_MIN_MS,
  TOY_BLASTER_DAMAGE,
  applyOfficeShot,
  createOfficeCombatState,
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
  });

  it('subtracts toy blaster damage without downing a healthy target', () => {
    const result = applyOfficeShot(createOfficeCombatState(1000), 1200, () => 0.25);

    expect(result.event).toBe('hit');
    expect(result.combat.shield).toBe(DEFAULT_OFFICE_SHIELD - TOY_BLASTER_DAMAGE);
    expect(result.combat.downedUntil).toBeNull();
    expect(result.combat.hitReaction).toBe(1);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('downs the target and schedules a respawn inside the allowed window', () => {
    let combat = createOfficeCombatState(1000);
    combat = { ...combat, shield: 20 };

    const result = applyOfficeShot(combat, 2000, () => 0.5);

    expect(result.event).toBe('downed');
    expect(result.combat.shield).toBe(0);
    expect(result.combat.downedUntil).not.toBeNull();
    expect(result.combat.downedUntil).toBeGreaterThanOrEqual(2000 + OFFICE_RESPAWN_MIN_MS);
    expect(result.combat.downedUntil).toBeLessThanOrEqual(2000 + OFFICE_RESPAWN_MAX_MS);
    expect(result.combat.lastWords).toBe(result.message);
  });

  it('ignores repeated shots while the target is downed', () => {
    const downed = {
      ...createOfficeCombatState(1000),
      shield: 0,
      downedUntil: 10000,
      lastWords: '等我重启一下。',
    };

    const result = applyOfficeShot(downed, 3000, () => 0.1);

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
    expect(early.revived).toBe(false);
    expect(early.combat).toEqual(downed);

    const revived = reviveOfficeCombatIfReady(downed, 7000, () => 0.2);
    expect(revived.revived).toBe(true);
    expect(revived.combat.shield).toBe(DEFAULT_OFFICE_SHIELD);
    expect(revived.combat.downedUntil).toBeNull();
    expect(revived.combat.lastWords).toBeNull();
    expect(revived.message.length).toBeGreaterThan(0);
  });

  it('uses deterministic random selection when a random function is injected', () => {
    const random = vi.fn(() => 0);

    const result = applyOfficeShot({ ...createOfficeCombatState(0), shield: 1 }, 100, random);

    expect(random).toHaveBeenCalled();
    expect(result.event).toBe('downed');
    expect(result.combat.downedUntil).toBe(100 + OFFICE_RESPAWN_MIN_MS);
  });
});
