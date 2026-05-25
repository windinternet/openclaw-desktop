export type {
  // Connection & Instance
  InstanceConfig,
  ConnectionStatus,
  ConnectionState,
  DiscoveredInstance,
  // User
  GatewayUser,
  // Agent
  AgentInfo,
  AgentIdentity,
  // Model
  ModelInfo,
  // Session & Chat
  SessionInfo,
  SessionMessage,
  ChatSendParams,
  ChatSendResult,
  ChatEventPayload,
  AgentEventPayload,
  // Cron
  CronJob,
  CronRun,
  // Tool & Skill
  ToolInfo,
  SkillInfo,
  SkillMarketplaceSourceId,
  SkillMarketplaceSource,
  SkillMarketplaceSkill,
  SkillMarketplaceSearchResponse,
  SkillMarketplaceSearchParams,
  SkillMarketplaceInstallResult,
  // Workspace
  WorkspaceFile,
  WorkspaceFileContent,
  // Health & Status
  GatewayHealth,
  GatewayStatus,
  // Kanban & Office
  KanbanColumn,
  KanbanCard,
  OfficeAgent,
  // Search
  SearchResult,
  // Protocol Frames
  RequestFrame,
  ResponseFrame,
  EventFrame,
  GatewayError,
  HelloOk,
  GatewayClientOptions,
} from './types';
export { useStore } from './store';
export { createGatewayClient } from './gateway';
export type { GatewayClient } from './gateway';
export {
  DEFAULT_SKILL_MARKETPLACE_SOURCE_ID,
  SKILL_MARKETPLACE_SOURCES,
  createSkillMarketplaceSearchUrl,
  fetchSkillMarketplaceSkills,
  getSkillMarketplaceSource,
  normalizeSkillMarketplaceSearchResponse,
} from './skill-marketplace';

export type {
  ThemeMode,
  ThemeColor,
  SupportedLocale,
  AppSettings,
} from './settings-types';
export { PRESET_THEME_COLORS, DEFAULT_SETTINGS } from './settings-types';
export { useSettingsStore } from './settings-store';
