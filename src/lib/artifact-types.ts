export type ArtifactType =
  | 'report'
  | 'dashboard'
  | 'analysis'
  | 'checklist'
  | 'code'
  | 'document'
  | 'slide'
  | 'form'
  | 'other'
  | 'link'
  | 'app'
  | 'file'
  | 'audio'
  | 'image'
  | 'video';

export type ArtifactExternalFormat =
  | 'html'
  | 'link'
  | 'app'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'pdf'
  | 'image'
  | 'audio'
  | 'video'
  | 'text'
  | 'code'
  | 'file'
  | 'unknown';

export type ArtifactReuseKind = 'asset' | 'template' | 'tool' | 'script' | 'workflow';

export type ArtifactFileInspectionSourceKind =
  | 'imported_file'
  | 'local_file'
  | 'external_url'
  | 'command'
  | 'metadata_only';
export type ArtifactFileInspectionOpenBehavior =
  | 'preview_html'
  | 'open_file'
  | 'open_link'
  | 'copy_command'
  | 'view_detail';
export type ArtifactFileInspectionPreviewStatus = 'native_preview' | 'external_app' | 'metadata_only';

export interface ArtifactFileInspection {
  inspectedAt: number;
  format: ArtifactExternalFormat;
  sourceKind: ArtifactFileInspectionSourceKind;
  openBehavior: ArtifactFileInspectionOpenBehavior;
  previewStatus: ArtifactFileInspectionPreviewStatus;
  summary: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storedPath?: string;
  originalPath?: string;
  url?: string;
  command?: string;
  limitations: string[];
}

export type ArtifactContentExtractStatus = 'extracted';
export type ArtifactContentExtractSourceKind = 'imported_file';

export interface ArtifactContentExtract {
  extractedAt: number;
  status: ArtifactContentExtractStatus;
  format: ArtifactExternalFormat;
  sourceKind: ArtifactContentExtractSourceKind;
  summary: string;
  fileName?: string;
  mimeType?: string;
  bytesRead: number;
  textLength: number;
  truncated: boolean;
  snippet: string;
}

export interface ArtifactSource {
  type: 'chat' | 'workflow' | 'agent_team' | 'manual' | 'mcp_tool' | 'action_run';
  id?: string;
  name?: string;
}

export type ArtifactHtmlAuditSeverity = 'warning' | 'danger';

export type ArtifactHtmlAuditIssueCode =
  | 'external-script'
  | 'external-stylesheet'
  | 'external-image'
  | 'external-media'
  | 'external-frame'
  | 'external-css-import'
  | 'external-css-url'
  | 'direct-network'
  | 'bridge-network-fetch'
  | 'bridge-file-read'
  | 'bridge-file-write'
  | 'bridge-shell-exec'
  | 'bridge-export'
  | 'bridge-notification';

export interface ArtifactHtmlAuditIssue {
  code: ArtifactHtmlAuditIssueCode;
  severity: ArtifactHtmlAuditSeverity;
  message: string;
  detail?: string;
}

export interface ArtifactHtmlAudit {
  selfContained: boolean;
  requiresApproval: boolean;
  issues: ArtifactHtmlAuditIssue[];
  checkedAt: number;
}

export type AuthLevel = 'once' | 'session' | 'artifact' | 'global';

export interface ArtifactRuntimeAuthEvent {
  id: string;
  capability: string;
  detail: string;
  granted: boolean;
  level: AuthLevel | string;
  requestedAt: number;
  decidedAt: number;
}

export type ArtifactBridgeCallStatus = 'succeeded' | 'denied' | 'failed' | 'unsupported';

export interface ArtifactRuntimeBridgeEvent {
  id: string;
  method: string;
  detail?: string;
  status: ArtifactBridgeCallStatus;
  resultSummary?: string;
  error?: string;
  startedAt: number;
  endedAt: number;
}

export type ArtifactReuseContext =
  | 'chat'
  | 'workflow'
  | 'agent_team'
  | 'manual'
  | 'mcp_tool'
  | 'action_run'
  | 'repository';
export type ArtifactReuseStatus = 'used' | 'succeeded' | 'failed' | 'cancelled';
export type ArtifactExecutionStatus =
  | 'approval_required'
  | 'approved'
  | 'denied'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface ArtifactReuseEvent {
  id: string;
  context: ArtifactReuseContext;
  status: ArtifactReuseStatus;
  artifactVersion: number;
  usedAt: number;
  sourceId?: string;
  sourceName?: string;
  purpose?: string;
  resultSummary?: string;
}

export interface ArtifactExecutionEvent {
  id: string;
  status: ArtifactExecutionStatus;
  artifactVersion: number;
  requestedAt: number;
  startedAt?: number;
  endedAt?: number;
  sourceId?: string;
  sourceName?: string;
  runner?: string;
  command?: string;
  approvalTitle?: string;
  approvalRisk?: string;
  approvalReason?: string;
  outputArtifactId?: string;
  repositoryOutputPath?: string;
  resultSummary?: string;
  error?: string;
}

export interface ArtifactMeta {
  id: string;
  title: string;
  description?: string;
  icon: string;
  type: ArtifactType;
  source: ArtifactSource;
  tags: string[];
  templateId?: string;
  currentVersion: number;
  versions?: VersionEntry[];
  thumbnail?: string;
  status: 'draft' | 'published' | 'archived';
  createdBy?: { agent?: string; model?: string };
  createdAt: number;
  updatedAt: number;
  url?: string;
  command?: string;
  filePath?: string;
  originalFilePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  externalFormat?: ArtifactExternalFormat;
  contentSummary?: string;
  fileInspection?: ArtifactFileInspection;
  contentExtract?: ArtifactContentExtract;
  reuseKind?: ArtifactReuseKind;
  repositoryOutputPath?: string;
  repositoryPreviewPath?: string;
  htmlAudit?: ArtifactHtmlAudit;
  authEvents?: ArtifactRuntimeAuthEvent[];
  bridgeEvents?: ArtifactRuntimeBridgeEvent[];
  reuseEvents?: ArtifactReuseEvent[];
  executionEvents?: ArtifactExecutionEvent[];
}

export interface VersionEntry {
  version: number;
  label: string;
  createdBy: 'ai' | 'user';
  sourceStep?: string;
  createdAt: number;
}

export interface ArtifactAuth {
  grants: Record<string, AuthLevel>;
  sessionId?: string;
}

export interface ArtifactTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  types: ArtifactType[];
  htmlTemplate: string;
  dataSchema?: Record<string, { type: string; description: string }>;
  builtin: boolean;
}
