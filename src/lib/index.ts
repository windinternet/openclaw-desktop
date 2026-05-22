export type {
  InstanceConfig,
  ConnectionStatus,
  ConnectionState,
  DiscoveredInstance,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  GatewayError,
  HelloOk,
  ChatEventPayload,
  GatewayClientOptions,
} from './types';
export { useStore } from './store';
export { createGatewayClient } from './gateway';
export type { GatewayClient } from './gateway';

export type {
  ThemeMode,
  ThemeColor,
  SupportedLocale,
  AppSettings,
} from './settings-types';
export { PRESET_THEME_COLORS, DEFAULT_SETTINGS } from './settings-types';
export { useSettingsStore } from './settings-store';
