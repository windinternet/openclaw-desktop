import type { AgentSwitchStrategy } from './agent-switch-settings';
import type { AssistantReplyGrouping, SessionToolCallDisplay } from './session-content';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColor {
  name: string;
  value: string;
  semiColor: string;
}

export const PRESET_THEME_COLORS: ThemeColor[] = [
  { name: 'blue', value: '#0066FF', semiColor: 'blue' },
  { name: 'purple', value: '#722ED1', semiColor: 'purple' },
  { name: 'cyan', value: '#00A870', semiColor: 'cyan' },
  { name: 'orange', value: '#ED7B2F', semiColor: 'orange' },
  { name: 'pink', value: '#E91E63', semiColor: 'pink' },
  { name: 'indigo', value: '#2E4CFF', semiColor: 'indigo' },
];

export type SupportedLocale = 'zh-CN' | 'en-US';

export interface AppSettings {
  initialized: boolean;
  themeMode: ThemeMode;
  themeColor: string;
  locale: SupportedLocale;
  userDisplayName: string;
  aiCompletionSound: string;
  connectAllInstancesOnStartup: boolean;
  externalLinkMode: 'system' | 'internal';
  agentSwitchStrategy: AgentSwitchStrategy;
  sessionToolCallDisplay: SessionToolCallDisplay;
  assistantReplyGrouping: AssistantReplyGrouping;
  openTuningOnStartup: boolean;
  sidebarNavGrouped: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  initialized: false,
  themeMode: 'dark',
  themeColor: 'blue',
  locale: 'zh-CN',
  userDisplayName: '',
  aiCompletionSound: 'mixkit-message-pop-alert-2354.mp3',
  connectAllInstancesOnStartup: false,
  externalLinkMode: 'system',
  agentSwitchStrategy: 'new-session',
  sessionToolCallDisplay: 'hidden',
  assistantReplyGrouping: 'merged',
  openTuningOnStartup: false,
  sidebarNavGrouped: false,
};
