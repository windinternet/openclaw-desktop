import { describe, expect, it, vi } from 'vitest';
import {
  OFFICE_NPC_YELPS,
  resolveOfficeImpactAudioCue,
  resolveOfficeReviveAudioCue,
  resolveOfficeVoiceText,
} from '../lib/office-audio';

describe('office audio cues', () => {
  it('maps hit results to a diagnostic hit sound and spoken reaction', () => {
    const cue = resolveOfficeImpactAudioCue({ event: 'hit', message: '状态灯抖了一下。' }, () => 0);

    if (!cue) throw new Error('expected hit cue');
    expect(cue.effect).toBe('diagnostic-hit');
    expect(cue.voice).toBe('状态灯抖了一下。');
  });

  it('maps downed results to a yelp, downed sound, and last words', () => {
    const cue = resolveOfficeImpactAudioCue({ event: 'downed', message: '等我重启一下钳子驱动。' }, () => 0);

    if (!cue) throw new Error('expected downed cue');
    expect(cue.effect).toBe('npc-downed');
    expect(cue.yelp).toBe(OFFICE_NPC_YELPS[0]);
    expect(cue.voice).toBe('等我重启一下钳子驱动。');
  });

  it('does not speak for ignored shots or absent messages', () => {
    expect(resolveOfficeImpactAudioCue({ event: 'ignored', message: null })).toBeNull();
    expect(resolveOfficeImpactAudioCue({ event: 'hit', message: null })).toEqual({
      effect: 'diagnostic-hit',
      voice: null,
      yelp: null,
    });
  });

  it('maps revive messages to a revive cue', () => {
    expect(resolveOfficeReviveAudioCue('复活完成。')).toEqual({
      effect: 'npc-revived',
      voice: '复活完成。',
      yelp: null,
    });
  });

  it('combines yelps and voice lines for speech synthesis', () => {
    expect(resolveOfficeVoiceText({ yelp: '啊！', voice: '我先下线。' })).toBe('啊！我先下线。');
    expect(resolveOfficeVoiceText({ yelp: null, voice: '疼一下。' })).toBe('疼一下。');
  });

  it('uses injected random selection for yelps', () => {
    const random = vi.fn(() => 0.999);

    const cue = resolveOfficeImpactAudioCue({ event: 'downed', message: '我裂开了。' }, random);

    expect(random).toHaveBeenCalled();
    expect(cue?.yelp).toBe(OFFICE_NPC_YELPS[OFFICE_NPC_YELPS.length - 1]);
  });
});
