export type {
  // Connection & Instance
  InstanceConfig,
  InstanceActivityKind,
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
export { createGatewayClient, GatewayConnectError } from './gateway';
export type { GatewayClient } from './gateway';
export {
  fetchGatewayAgentFileContent,
  fetchGatewayAgentFiles,
  fetchGatewayAgents,
  isMarkdownAgentFile,
  saveGatewayAgentFileContent,
} from './gateway-agents';
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
export type { AssistantReplyGrouping, SessionMessageDisplaySettings, SessionToolCallDisplay } from './session-content';
export { DEFAULT_SESSION_MESSAGE_DISPLAY_SETTINGS, normalizeSessionMessageDisplaySettings } from './session-content';
export type { AgentSwitchStrategy, InstanceAgentSwitchStrategy } from './agent-switch-settings';
export { resolveAgentSwitchStrategy } from './agent-switch-settings';
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
  queryAiActionRunStatus,
  resumeAiActionRunWithGateway,
} from './ai-action-center';
export {
  assignAiActionRunToWorkItem,
  loadAiActionRuns,
  recoverInterruptedAiActionRuns,
  resyncAiActionRun,
  resumeStalledAiActionRun,
  saveAiActionRuns,
  syncAiActionRunsWithGateway,
  upsertAiActionRun,
} from './ai-action-run-store';
export { DESKTOP_BRIDGE_CAPABILITIES, connectDesktopBridgeToGateway, disconnectDesktopBridge } from './desktop-bridge';
