import type { OfficeShotEvent } from './office-gameplay';

export type OfficeAudioEffect = 'blaster-shot' | 'shield-hit' | 'npc-downed' | 'npc-revived';

export interface OfficeAudioCue {
  effect: OfficeAudioEffect;
  voice: string | null;
  yelp: string | null;
}

export interface OfficeImpactAudioInput {
  event: OfficeShotEvent;
  message: string | null;
}

type BrowserAudioContext = AudioContext & {
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
};

type WindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export const OFFICE_NPC_YELPS = [
  '啊！',
  '哎哟！',
  '救命，我的工位！',
  '这不在需求里！',
];

let officeAudioContext: BrowserAudioContext | null = null;

export function resolveOfficeImpactAudioCue(
  result: OfficeImpactAudioInput,
  random = Math.random,
): OfficeAudioCue | null {
  if (result.event === 'ignored') return null;

  if (result.event === 'downed') {
    return {
      effect: 'npc-downed',
      yelp: pickRandom(OFFICE_NPC_YELPS, random),
      voice: result.message,
    };
  }

  return {
    effect: 'shield-hit',
    yelp: null,
    voice: result.message,
  };
}

export function resolveOfficeReviveAudioCue(message: string | null): OfficeAudioCue | null {
  if (!message) return null;

  return {
    effect: 'npc-revived',
    yelp: null,
    voice: message,
  };
}

export function resolveOfficeVoiceText(cue: Pick<OfficeAudioCue, 'voice' | 'yelp'>): string | null {
  const text = [cue.yelp, cue.voice].filter(Boolean).join('');
  return text || null;
}

export function playOfficeBlasterShotAudio(): void {
  const context = getOfficeAudioContext();
  if (!context) return;

  playSweep(context, 780, 220, 0.12, 0.08, 'sawtooth');
  playNoiseBurst(context, 0.055, 0.035, 3600);
}

export function playOfficeImpactAudio(cue: OfficeAudioCue | null): void {
  if (!cue) return;

  const context = getOfficeAudioContext();
  if (context) {
    if (cue.effect === 'shield-hit') {
      playSweep(context, 420, 190, 0.1, 0.06, 'triangle');
      playNoiseBurst(context, 0.075, 0.04, 1800);
    } else if (cue.effect === 'npc-downed') {
      playSweep(context, 520, 95, 0.28, 0.075, 'sawtooth');
      playNoiseBurst(context, 0.12, 0.055, 900);
    } else if (cue.effect === 'npc-revived') {
      playSweep(context, 220, 760, 0.22, 0.055, 'triangle');
    }
  }

  speakOfficeCue(cue);
}

function getOfficeAudioContext(): BrowserAudioContext | null {
  if (typeof window === 'undefined') return null;

  if (officeAudioContext) {
    resumeOfficeAudioContext(officeAudioContext);
    return officeAudioContext;
  }

  const AudioContextCtor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
  if (!AudioContextCtor) return null;

  try {
    officeAudioContext = new AudioContextCtor() as BrowserAudioContext;
    resumeOfficeAudioContext(officeAudioContext);
    return officeAudioContext;
  } catch {
    return null;
  }
}

function resumeOfficeAudioContext(context: BrowserAudioContext): void {
  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined);
  }
}

function playSweep(
  context: BrowserAudioContext,
  startFrequency: number,
  endFrequency: number,
  duration: number,
  gainValue: number,
  type: OscillatorType,
): void {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.025);
}

function playNoiseBurst(
  context: BrowserAudioContext,
  duration: number,
  gainValue: number,
  toneFrequency: number,
): void {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const envelope = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const now = context.currentTime;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(toneFrequency, now);
  filter.Q.setValueAtTime(8, now);
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(now);
}

function speakOfficeCue(cue: OfficeAudioCue): void {
  const text = resolveOfficeVoiceText(cue);
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = cue.effect === 'npc-downed' ? 1.25 : 1.08;
  utterance.pitch = cue.effect === 'npc-downed' ? 1.35 : 1.08;
  utterance.volume = 0.86;
  window.speechSynthesis.speak(utterance);
}

function pickRandom(messages: readonly string[], random: () => number): string {
  const index = Math.min(messages.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * messages.length));
  return messages[index];
}
