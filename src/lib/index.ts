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
  AgentLocalProfile,
  AgentTeamInstruction,
  AgentTeamProfile,
  AiActionRun,
  AiActionRunStatus,
  AiActionExecutionMode,
  AiActionApproval,
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
  OfficeProfile,
  OfficeLayoutInstruction,
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
export { fetchGatewayAgentFileContent, fetchGatewayAgentFiles, fetchGatewayAgents } from './gateway-agents';
export {
  DEFAULT_SKILL_MARKETPLACE_SOURCE_ID,
  SKILL_MARKETPLACE_SOURCES,
  createSkillMarketplaceSearchUrl,
  fetchSkillMarketplaceSkills,
  getSkillMarketplaceSource,
  normalizeSkillMarketplaceSearchResponse,
} from './skill-marketplace';

export type { ThemeMode, ThemeColor, SupportedLocale, AppSettings } from './settings-types';
export { PRESET_THEME_COLORS, DEFAULT_SETTINGS } from './settings-types';
export { useSettingsStore } from './settings-store';
export {
  AI_ACTION_RUNS_STORAGE_KEY,
  DESKTOP_ACTION_LABEL_PREFIX,
  DESKTOP_ACTION_PEER_PREFIX,
  DESKTOP_THREAD_PEER_PREFIX,
  buildAiActionDomainThreadKey,
  buildAiActionGatewaySessionCreateRequest,
  buildAiActionSessionKey,
  buildAiActionSessionLabel,
  buildUniqueAiActionSessionLabel,
  applyAiActionAssistantResponse,
  createAiActionRun,
  executeAiActionRunWithGateway,
  filterUserVisibleSessions,
  isDesktopManagedSession,
  normalizeAiActionRuns,
  parseAiActionAssistantResponse,
  resolveAiActionApprovalWithGateway,
  syncAiActionRunWithGateway,
} from './ai-action-center';
export {
  loadAiActionRuns,
  saveAiActionRuns,
  syncAiActionRunsWithGateway,
  upsertAiActionRun,
} from './ai-action-run-store';
export { DESKTOP_BRIDGE_CAPABILITIES, connectDesktopBridgeToGateway, disconnectDesktopBridge } from './desktop-bridge';
