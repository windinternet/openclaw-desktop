import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import alertBellsEcho from './mixkit-alert-bells-echo-765.wav';
import alertQuickChime from './mixkit-alert-quick-chime-766.wav';
import arcadeBonusAlert from './mixkit-arcade-bonus-alert-767.wav';
import bonusEarnedInVideoGame from './mixkit-bonus-earned-in-video-game-2058.wav';
import bubblePopUpAlertNotification from './mixkit-bubble-pop-up-alert-notification-2357.wav';
import confirmationTone from './mixkit-confirmation-tone-2867.wav';
import digitalQuickTone from './mixkit-digital-quick-tone-2866.wav';
import dryPopUpNotificationAlert from './mixkit-dry-pop-up-notification-alert-2356.wav';
import gameSuccessAlert from './mixkit-game-success-alert-2039.wav';
import guitarNotificationAlert from './mixkit-guitar-notification-alert-2320.wav';
import longPop from './mixkit-long-pop-2358.wav';
import messagePopAlert from './mixkit-message-pop-alert-2354.mp3';
import softwareInterfaceBack from './mixkit-software-interface-back-2575.wav';
import softwareInterfaceRemove from './mixkit-software-interface-remove-2576.wav';
import softwareInterfaceStart from './mixkit-software-interface-start-2574.wav';

export const DEFAULT_ALERT_SOUND = 'mixkit-message-pop-alert-2354.mp3';

export const alertSounds = {
  'mixkit-alert-bells-echo-765.wav': {
    labelKey: 'settings.alertSounds.bellsEcho',
    src: alertBellsEcho,
  },
  'mixkit-alert-quick-chime-766.wav': {
    labelKey: 'settings.alertSounds.quickChime',
    src: alertQuickChime,
  },
  'mixkit-arcade-bonus-alert-767.wav': {
    labelKey: 'settings.alertSounds.arcadeBonus',
    src: arcadeBonusAlert,
  },
  'mixkit-bonus-earned-in-video-game-2058.wav': {
    labelKey: 'settings.alertSounds.gameBonus',
    src: bonusEarnedInVideoGame,
  },
  'mixkit-bubble-pop-up-alert-notification-2357.wav': {
    labelKey: 'settings.alertSounds.bubblePop',
    src: bubblePopUpAlertNotification,
  },
  'mixkit-confirmation-tone-2867.wav': {
    labelKey: 'settings.alertSounds.confirmationTone',
    src: confirmationTone,
  },
  'mixkit-digital-quick-tone-2866.wav': {
    labelKey: 'settings.alertSounds.digitalTone',
    src: digitalQuickTone,
  },
  'mixkit-dry-pop-up-notification-alert-2356.wav': {
    labelKey: 'settings.alertSounds.dryPop',
    src: dryPopUpNotificationAlert,
  },
  'mixkit-game-success-alert-2039.wav': {
    labelKey: 'settings.alertSounds.gameSuccess',
    src: gameSuccessAlert,
  },
  'mixkit-guitar-notification-alert-2320.wav': {
    labelKey: 'settings.alertSounds.guitarAlert',
    src: guitarNotificationAlert,
  },
  'mixkit-long-pop-2358.wav': {
    labelKey: 'settings.alertSounds.longPop',
    src: longPop,
  },
  'mixkit-message-pop-alert-2354.mp3': {
    labelKey: 'settings.alertSounds.messagePop',
    src: messagePopAlert,
  },
  'mixkit-software-interface-back-2575.wav': {
    labelKey: 'settings.alertSounds.interfaceBack',
    src: softwareInterfaceBack,
  },
  'mixkit-software-interface-remove-2576.wav': {
    labelKey: 'settings.alertSounds.interfaceRemove',
    src: softwareInterfaceRemove,
  },
  'mixkit-software-interface-start-2574.wav': {
    labelKey: 'settings.alertSounds.interfaceStart',
    src: softwareInterfaceStart,
  },
} as const;

export type AlertSoundId = keyof typeof alertSounds;

export function getAlertOptions(t: TFunction): { label: string; value: AlertSoundId }[] {
  return Object.entries(alertSounds).map(([value, item]) => ({
    label: t(item.labelKey),
    value: value as AlertSoundId,
  }));
}

export function useAlertOptions(): { label: string; value: AlertSoundId }[] {
  const { t } = useTranslation();
  return useMemo(() => getAlertOptions(t), [t]);
}

export function resolveAlertSound(soundId?: string): (typeof alertSounds)[AlertSoundId] {
  if (soundId && soundId in alertSounds) {
    return alertSounds[soundId as AlertSoundId];
  }
  return alertSounds[DEFAULT_ALERT_SOUND];
}

export function playAlertSound(soundId?: string): void {
  const audio = new Audio(resolveAlertSound(soundId).src);
  audio.play().catch(() => {
    // 浏览器可能会因自动播放策略拒绝声音，通知本身仍可以继续展示。
  });
}
