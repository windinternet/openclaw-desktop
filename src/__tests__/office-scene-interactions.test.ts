import { describe, expect, it } from 'vitest';
import {
  canControlOfficeActor,
  canOfficeActorJump,
  canUseOfficeBlaster,
  copyBillboardQuaternion,
  isOfficeActorDowned,
  resolveNearestOfficeControlTarget,
  resolveOfficeControlTarget,
  resolveOfficeShotTarget,
  shouldSkipBlasterMouseDown,
  type OfficeShotTargetActor,
  type OfficeShotTargetHit,
} from '../components/office/office-scene-interactions';

describe('office scene interaction helpers', () => {
  it('skips mouse drag start only for armed first-person left clicks', () => {
    expect(shouldSkipBlasterMouseDown(0, 'first-person', 'toy-blaster')).toBe(true);

    expect(shouldSkipBlasterMouseDown(0, 'third-person', 'toy-blaster')).toBe(false);
    expect(shouldSkipBlasterMouseDown(0, 'first-person', 'hands')).toBe(false);
    expect(shouldSkipBlasterMouseDown(1, 'first-person', 'toy-blaster')).toBe(false);
  });

  it('returns the first live shot target after skipping self, missing actors, and downed actors', () => {
    const actors = new Map<string, OfficeShotTargetActor>([
      ['self-agent', { combat: { downedUntil: null } }],
      ['downed-agent', { combat: { downedUntil: 5000 } }],
      ['live-agent', { combat: { downedUntil: null } }],
    ]);
    const hits: OfficeShotTargetHit[] = [
      { object: { userData: { agentId: 42 } } },
      { object: { userData: { agentId: 'self-agent' } } },
      { object: { userData: { agentId: 'unknown-agent' } } },
      { object: { userData: { agentId: 'downed-agent' } } },
      { object: { userData: { agentId: 'live-agent' } } },
    ];

    expect(resolveOfficeShotTarget(hits, actors, 'self-agent')).toBe('live-agent');
  });

  it('returns null when every raycast hit is invalid', () => {
    const actors = new Map<string, OfficeShotTargetActor>([
      ['self-agent', { combat: { downedUntil: null } }],
      ['downed-agent', { combat: { downedUntil: 5000 } }],
    ]);
    const hits: OfficeShotTargetHit[] = [
      { object: { userData: {} } },
      { object: { userData: { agentId: 'self-agent' } } },
      { object: { userData: { agentId: 'missing-agent' } } },
      { object: { userData: { agentId: 'downed-agent' } } },
    ];

    expect(resolveOfficeShotTarget(hits, actors, 'self-agent')).toBeNull();
  });

  it('blocks control and blaster use for missing or downed actors', () => {
    const live = { combat: { downedUntil: null } };
    const downed = { combat: { downedUntil: 5000 } };

    expect(isOfficeActorDowned(live)).toBe(false);
    expect(isOfficeActorDowned(downed)).toBe(true);
    expect(isOfficeActorDowned(null)).toBe(false);

    expect(canControlOfficeActor(live)).toBe(true);
    expect(canControlOfficeActor(downed)).toBe(false);
    expect(canControlOfficeActor(null)).toBe(false);

    expect(canUseOfficeBlaster(live)).toBe(true);
    expect(canUseOfficeBlaster(downed)).toBe(false);
    expect(canUseOfficeBlaster(null)).toBe(false);
  });

  it('resolves control raycast hits by skipping missing and downed actors', () => {
    const actors = new Map<string, OfficeShotTargetActor>([
      ['downed-agent', { combat: { downedUntil: 5000 } }],
      ['live-agent', { combat: { downedUntil: null } }],
    ]);
    const hits: OfficeShotTargetHit[] = [
      { object: { userData: { agentId: 42 } } },
      { object: { userData: { agentId: 'missing-agent' } } },
      { object: { userData: { agentId: 'downed-agent' } } },
      { object: { userData: { agentId: 'live-agent' } } },
    ];

    expect(resolveOfficeControlTarget(hits, actors)).toBe('live-agent');
  });

  it('returns null when control raycast hits only missing or downed actors', () => {
    const actors = new Map<string, OfficeShotTargetActor>([
      ['downed-agent', { combat: { downedUntil: 5000 } }],
    ]);
    const hits: OfficeShotTargetHit[] = [
      { object: { userData: { agentId: 'missing-agent' } } },
      { object: { userData: { agentId: 'downed-agent' } } },
    ];

    expect(resolveOfficeControlTarget(hits, actors)).toBeNull();
  });

  it('resolves nearest fallback by skipping downed actors and enforcing range', () => {
    const downed = { combat: { downedUntil: 5000 } };
    const live = { combat: { downedUntil: null } };

    expect(resolveNearestOfficeControlTarget([
      { agentId: 'downed-agent', actor: downed, distance: 0.2 },
      { agentId: 'live-agent', actor: live, distance: 1.1 },
    ], 1.45)).toBe('live-agent');

    expect(resolveNearestOfficeControlTarget([
      { agentId: 'downed-agent', actor: downed, distance: 0.2 },
      { agentId: 'far-live-agent', actor: live, distance: 1.6 },
    ], 1.45)).toBeNull();
  });

  it('allows jumping only for live actors that are on the ground', () => {
    const liveGrounded = { combat: { downedUntil: null }, group: { position: { y: 0.005 } } };
    const liveAirborne = { combat: { downedUntil: null }, group: { position: { y: 0.5 } } };
    const downedGrounded = { combat: { downedUntil: 5000 }, group: { position: { y: 0.02 } } };

    expect(canOfficeActorJump(liveGrounded, 0)).toBe(true);
    expect(canOfficeActorJump(liveAirborne, 0)).toBe(false);
    expect(canOfficeActorJump(downedGrounded, 0)).toBe(false);
    expect(canOfficeActorJump(null, 0)).toBe(false);
  });

  it('copies the active camera quaternion onto billboarded combat UI', () => {
    const shieldBar = {
      copied: '',
      quaternion: {
        copy(source: { id: string }) {
          shieldBar.copied = source.id;
          return this;
        },
      },
    };
    const camera = { quaternion: { id: 'first-person-camera-facing' } };

    copyBillboardQuaternion(shieldBar, camera);

    expect(shieldBar.copied).toBe('first-person-camera-facing');
  });
});
