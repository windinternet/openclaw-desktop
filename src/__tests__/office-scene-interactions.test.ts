import { describe, expect, it } from 'vitest';
import {
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
});
