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

export interface ArtifactSource {
  type: 'chat' | 'workflow' | 'agent_team' | 'manual' | 'mcp_tool' | 'action_run';
  id?: string;
  name?: string;
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
  thumbnail?: string;
  status: 'draft' | 'published' | 'archived';
  createdBy?: { agent?: string; model?: string };
  createdAt: number;
  updatedAt: number;
  url?: string;
  command?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  repositoryOutputPath?: string;
  repositoryPreviewPath?: string;
}

export interface VersionEntry {
  version: number;
  label: string;
  createdBy: 'ai' | 'user';
  sourceStep?: string;
  createdAt: number;
}

export type AuthLevel = 'once' | 'session' | 'artifact' | 'global';

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
