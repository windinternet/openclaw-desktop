import type {
  ArtifactExecutionStatus,
  ArtifactExternalFormat,
  ArtifactMeta,
  ArtifactReuseContext,
  ArtifactReuseKind,
  ArtifactReuseStatus,
  ArtifactType,
} from './artifact-types';
import { artifactService, type GenerateParams } from './artifact-service';
import { artifactPersistence } from './artifact-persistence';
import { buildArtifactPreviewCard, buildArtifactSearchText } from './artifact-display';
import { buildArtifactReuseReference } from './artifact-reference';
import { recordArtifactExecutionEvent } from './artifact-execution-record';
import { recordArtifactReuseEvent } from './artifact-reuse-record';
import { buildArtifactVersionHistory } from './artifact-version-history';
import { createDefaultRepositoryBinding, getRepositoryGateStatus } from './agentic-repository';
import {
  buildArtifactRepositoryOutputUpdates,
  createRepositoryOutput,
  type RepositoryOutputResult,
} from './repository-outputs';

const ARTIFACT_TYPES = new Set<ArtifactType>([
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
  'link',
  'app',
  'file',
  'audio',
  'image',
  'video',
]);

const ARTIFACT_EXTERNAL_FORMATS = new Set<ArtifactExternalFormat>([
  'html',
  'link',
  'app',
  'word',
  'excel',
  'powerpoint',
  'pdf',
  'image',
  'audio',
  'video',
  'text',
  'code',
  'file',
  'unknown',
]);

const ARTIFACT_REUSE_KINDS = new Set<ArtifactReuseKind>(['asset', 'template', 'tool', 'script', 'workflow']);
const ARTIFACT_SOURCE_TYPES = new Set<ArtifactMeta['source']['type']>([
  'chat',
  'workflow',
  'agent_team',
  'manual',
  'mcp_tool',
  'action_run',
]);
const ARTIFACT_REUSE_CONTEXTS = new Set<ArtifactReuseContext>([
  'chat',
  'workflow',
  'agent_team',
  'manual',
  'mcp_tool',
  'action_run',
  'repository',
]);
const ARTIFACT_REUSE_STATUSES = new Set<ArtifactReuseStatus>(['used', 'succeeded', 'failed', 'cancelled']);
const ARTIFACT_EXECUTION_STATUSES = new Set<ArtifactExecutionStatus>([
  'approval_required',
  'approved',
  'denied',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
const ARTIFACT_EXECUTABLE_REUSE_KINDS = new Set<ArtifactReuseKind>(['tool', 'script', 'workflow']);
const ARTIFACT_STATUSES = new Set<ArtifactMeta['status']>(['draft', 'published', 'archived']);

const HTML_ARTIFACT_TYPES = new Set<ArtifactType>([
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tagsValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function artifactTypeValue(value: unknown): ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.has(value as ArtifactType) ? (value as ArtifactType) : 'other';
}

function optionalArtifactTypeValue(value: unknown): ArtifactType | undefined {
  return typeof value === 'string' && ARTIFACT_TYPES.has(value as ArtifactType) ? (value as ArtifactType) : undefined;
}

function artifactExternalFormatValue(value: unknown): ArtifactExternalFormat | undefined {
  return typeof value === 'string' && ARTIFACT_EXTERNAL_FORMATS.has(value as ArtifactExternalFormat)
    ? (value as ArtifactExternalFormat)
    : undefined;
}

function artifactReuseKindValue(value: unknown): ArtifactReuseKind | undefined {
  return typeof value === 'string' && ARTIFACT_REUSE_KINDS.has(value as ArtifactReuseKind)
    ? (value as ArtifactReuseKind)
    : undefined;
}

function artifactReuseContextValue(value: unknown): ArtifactReuseContext {
  return typeof value === 'string' && ARTIFACT_REUSE_CONTEXTS.has(value as ArtifactReuseContext)
    ? (value as ArtifactReuseContext)
    : 'mcp_tool';
}

function artifactReuseStatusValue(value: unknown): ArtifactReuseStatus {
  return typeof value === 'string' && ARTIFACT_REUSE_STATUSES.has(value as ArtifactReuseStatus)
    ? (value as ArtifactReuseStatus)
    : 'used';
}

function artifactExecutionStatusValue(value: unknown): ArtifactExecutionStatus {
  return typeof value === 'string' && ARTIFACT_EXECUTION_STATUSES.has(value as ArtifactExecutionStatus)
    ? (value as ArtifactExecutionStatus)
    : 'approval_required';
}

function artifactStatusValue(value: unknown): ArtifactMeta['status'] | undefined {
  return typeof value === 'string' && ARTIFACT_STATUSES.has(value as ArtifactMeta['status'])
    ? (value as ArtifactMeta['status'])
    : undefined;
}

function artifactSourceTypeValue(value: unknown): ArtifactMeta['source']['type'] | undefined {
  return typeof value === 'string' && ARTIFACT_SOURCE_TYPES.has(value as ArtifactMeta['source']['type'])
    ? (value as ArtifactMeta['source']['type'])
    : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function invalidParams(message: string): { ok: false; error: 'invalid-params'; message: string } {
  return { ok: false, error: 'invalid-params', message };
}

function repositoryApi() {
  return (globalThis as { window?: Window }).window?.electronAPI?.repository;
}

function slugPathSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'session'
  );
}

function buildSessionSummaryMarkdown(params: {
  sessionKey: string;
  title?: string;
  summary: string;
  highlights: string[];
  artifacts: string[];
}): string {
  const lines = [
    `# ${params.title || params.sessionKey}`,
    '',
    `sessionKey: ${params.sessionKey}`,
    `updatedAt: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    params.summary,
    '',
  ];

  if (params.highlights.length > 0) {
    lines.push('## Highlights', '');
    for (const highlight of params.highlights) lines.push(`- ${highlight}`);
    lines.push('');
  }

  if (params.artifacts.length > 0) {
    lines.push('## Outputs', '');
    for (const artifact of params.artifacts) lines.push(`- ${artifact}`);
    lines.push('');
  }

  return lines.join('\n');
}

async function mirrorRepositoryOutput(params: { repoPath: string; gatewayInstanceId?: string; artifactId: string }) {
  const artifact = await artifactPersistence.loadMeta(params.artifactId);
  if (!artifact) return null;
  const html = await artifactPersistence.loadHtml(params.artifactId, artifact.currentVersion);
  const output = await createRepositoryOutput({
    binding: createDefaultRepositoryBinding({
      gatewayInstanceId: params.gatewayInstanceId ?? 'desktop-node',
      repoPath: params.repoPath,
    }),
    artifact,
    html: html ?? undefined,
  });
  await recordRepositoryOutput(params.artifactId, output);
  return output;
}

async function recordRepositoryOutput(artifactId: string, output: RepositoryOutputResult): Promise<void> {
  await artifactService.update(artifactId, buildArtifactRepositoryOutputUpdates(output));
}

function buildArtifactSearchResult(artifact: ArtifactMeta) {
  const reference = buildArtifactReuseReference(artifact);
  const lastExecutionEvent = artifact.executionEvents?.[artifact.executionEvents.length - 1];
  return {
    id: artifact.id,
    title: artifact.title,
    description: artifact.description,
    type: artifact.type,
    uri: reference.uri,
    currentVersion: artifact.currentVersion,
    status: artifact.status,
    externalFormat: artifact.externalFormat,
    contentSummary: artifact.contentSummary,
    reuseKind: artifact.reuseKind,
    tags: artifact.tags,
    source: artifact.source,
    repositoryOutputPath: artifact.repositoryOutputPath,
    repositoryPreviewPath: artifact.repositoryPreviewPath,
    fileName: artifact.fileName,
    url: artifact.url,
    command: artifact.command,
    previewCard: buildArtifactPreviewCard(artifact),
    executionEventCount: artifact.executionEvents?.length ?? 0,
    lastExecutionEvent,
    updatedAt: artifact.updatedAt,
    reference: reference.markdown,
  };
}

function artifactSearchLimit(value: unknown): number {
  const limit = Math.trunc(numberValue(value) ?? 10);
  return Math.max(1, Math.min(limit, 50));
}

function buildArtifactGenerateParams(params: Record<string, unknown>, command: string): GenerateParams {
  return {
    title: stringValue(params.title) ?? '',
    html: stringValue(params.html),
    type: artifactTypeValue(params.type),
    icon: stringValue(params.icon),
    description: stringValue(params.description),
    tags: tagsValue(params.tags),
    url: stringValue(params.url),
    command: stringValue(params.command),
    filePath: stringValue(params.filePath),
    fileName: stringValue(params.fileName),
    fileSize: numberValue(params.fileSize),
    mimeType: stringValue(params.mimeType),
    externalFormat: artifactExternalFormatValue(params.externalFormat),
    contentSummary: stringValue(params.contentSummary),
    reuseKind: artifactReuseKindValue(params.reuseKind),
    importFile: booleanValue(params.importFile),
    source: { type: 'mcp_tool', name: command },
  };
}

export async function handleDesktopNodeCommand(command: string, params: unknown): Promise<unknown> {
  if (!isObject(params)) {
    return invalidParams('params must be an object');
  }

  if (command === 'desktop.artifacts.create') {
    const repoPath = stringValue(params.repoPath);
    const generateParams = buildArtifactGenerateParams(params, command);
    if (!generateParams.title) return invalidParams('title is required');
    if (HTML_ARTIFACT_TYPES.has(generateParams.type) && !generateParams.html) return invalidParams('html is required');

    const artifact = await artifactService.generate(generateParams);

    const result: {
      ok: true;
      artifact: { id: string; title: string; currentVersion: number };
      output?: { outputId: string; path: string; previewPath?: string };
    } = {
      ok: true,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        currentVersion: artifact.currentVersion,
      },
    };
    if (repoPath) {
      const output = await createRepositoryOutput({
        binding: createDefaultRepositoryBinding({
          gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
          repoPath,
        }),
        artifact,
        html: generateParams.html,
      });
      await recordRepositoryOutput(artifact.id, output);
      result.output = {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      };
    }
    return result;
  }

  if (command === 'desktop.outputs.create') {
    const repoPath = stringValue(params.repoPath);
    const generateParams = buildArtifactGenerateParams(params, command);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!generateParams.title) return invalidParams('title is required');
    if (HTML_ARTIFACT_TYPES.has(generateParams.type) && !generateParams.html) return invalidParams('html is required');

    const artifact = await artifactService.generate(generateParams);
    const output = await createRepositoryOutput({
      binding: createDefaultRepositoryBinding({
        gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
        repoPath,
      }),
      artifact,
      html: generateParams.html,
    });
    await recordRepositoryOutput(artifact.id, output);

    return {
      ok: true,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        currentVersion: artifact.currentVersion,
      },
      output: {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      },
    };
  }

  if (command === 'desktop.outputs.open') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const version = typeof params.version === 'number' ? params.version : undefined;
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) return { ok: false, error: 'not-found', artifactId };
    await artifactPersistence.openWindow(artifactId, version ?? meta.currentVersion);
    return { ok: true, artifactId };
  }

  if (command === 'desktop.outputs.update') {
    const repoPath = stringValue(params.repoPath);
    const artifactId = stringValue(params.artifactId);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!artifactId) return invalidParams('artifactId is required');
    await artifactService.update(artifactId, {
      title: stringValue(params.title),
      description: stringValue(params.description),
      icon: stringValue(params.icon),
      type: params.type === undefined ? undefined : artifactTypeValue(params.type),
      tags: tagsValue(params.tags),
    });
    const output = await mirrorRepositoryOutput({
      repoPath,
      artifactId,
      gatewayInstanceId: stringValue(params.gatewayInstanceId),
    });
    if (!output) return { ok: false, error: 'not-found', artifactId };
    return {
      ok: true,
      artifactId,
      output: {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      },
    };
  }

  if (command === 'desktop.outputs.append') {
    const repoPath = stringValue(params.repoPath);
    const artifactId = stringValue(params.artifactId);
    const htmlChunk = stringValue(params.htmlChunk);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!artifactId) return invalidParams('artifactId is required');
    if (!htmlChunk) return invalidParams('htmlChunk is required');
    await artifactService.append(artifactId, htmlChunk);
    const output = await mirrorRepositoryOutput({
      repoPath,
      artifactId,
      gatewayInstanceId: stringValue(params.gatewayInstanceId),
    });
    if (!output) return { ok: false, error: 'not-found', artifactId };
    return {
      ok: true,
      artifactId,
      output: {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      },
    };
  }

  if (command === 'desktop.repository.status') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.checkGit || !repository.inspect) return { ok: false, error: 'repository-api-unavailable' };
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
      repoPath,
    });
    const gitAvailable = await repository.checkGit();
    const details = await repository.inspect(repoPath);
    const status = getRepositoryGateStatus({ binding, gitAvailable, ...details });
    return { ok: true, status, details };
  }

  if (command === 'desktop.repository.init') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.init) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, details: await repository.init(repoPath) };
  }

  if (command === 'desktop.repository.read') {
    const repoPath = stringValue(params.repoPath);
    const relativePath = stringValue(params.path);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!relativePath) return invalidParams('path is required');
    const repository = repositoryApi();
    if (!repository?.readText) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, path: relativePath, content: await repository.readText(repoPath, relativePath) };
  }

  if (command === 'desktop.repository.write') {
    const repoPath = stringValue(params.repoPath);
    const relativePath = stringValue(params.path);
    const content = typeof params.content === 'string' ? params.content : undefined;
    if (!repoPath) return invalidParams('repoPath is required');
    if (!relativePath) return invalidParams('path is required');
    if (content === undefined) return invalidParams('content is required');
    const repository = repositoryApi();
    if (!repository?.writeText) return { ok: false, error: 'repository-api-unavailable' };
    await repository.writeText(repoPath, relativePath, content);
    return { ok: true, path: relativePath };
  }

  if (command === 'desktop.repository.search') {
    const repoPath = stringValue(params.repoPath);
    const query = stringValue(params.query);
    const directories = Array.isArray(params.directories)
      ? params.directories.filter((item): item is string => typeof item === 'string')
      : ['sources', 'wiki', 'work', 'plans', 'runs', 'outputs', 'reviews'];
    if (!repoPath) return invalidParams('repoPath is required');
    if (!query) return invalidParams('query is required');
    const repository = repositoryApi();
    if (!repository?.search) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, results: await repository.search(repoPath, query, directories) };
  }

  if (command === 'desktop.repository.git.status') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.gitStatus) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, status: await repository.gitStatus(repoPath) };
  }

  if (command === 'desktop.repository.git.diff') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.gitDiff) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, diff: await repository.gitDiff(repoPath) };
  }

  if (command === 'desktop.repository.git.log') {
    const repoPath = stringValue(params.repoPath);
    const relativePath = stringValue(params.path);
    const limit = numberValue(params.limit) ?? 12;
    if (!repoPath) return invalidParams('repoPath is required');
    if (!relativePath) return invalidParams('path is required');
    const repository = repositoryApi();
    if (!repository?.gitLog) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, commits: await repository.gitLog(repoPath, relativePath, limit) };
  }

  if (command === 'desktop.repository.git.commit') {
    const repoPath = stringValue(params.repoPath);
    const message = stringValue(params.message);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!message) return invalidParams('message is required');
    const repository = repositoryApi();
    if (!repository?.gitCommit) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, commit: await repository.gitCommit(repoPath, message) };
  }

  if (command === 'desktop.repository.session-summary.write') {
    const repoPath = stringValue(params.repoPath);
    const sessionKey = stringValue(params.sessionKey);
    const summary = stringValue(params.summary);
    const title = stringValue(params.title);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!sessionKey) return invalidParams('sessionKey is required');
    if (!summary) return invalidParams('summary is required');
    const repository = repositoryApi();
    if (!repository?.writeText || !repository.readText) return { ok: false, error: 'repository-api-unavailable' };

    const relativePath = `runs/session-summaries/${slugPathSegment(sessionKey)}.md`;
    await repository.writeText(
      repoPath,
      relativePath,
      buildSessionSummaryMarkdown({
        sessionKey,
        title,
        summary,
        highlights: stringArrayValue(params.highlights),
        artifacts: stringArrayValue(params.artifacts),
      }),
    );

    const indexPath = 'runs/session-summaries/index.md';
    const existingIndex = await repository.readText(repoPath, indexPath);
    const indexEntry = `- [${title || sessionKey}](${relativePath})`;
    const nextIndex = existingIndex.includes(relativePath)
      ? existingIndex
      : `${existingIndex.trimEnd()}\n${indexEntry}\n`;
    await repository.writeText(repoPath, indexPath, nextIndex);
    return { ok: true, path: relativePath };
  }

  if (command === 'desktop.artifacts.append') {
    const artifactId = stringValue(params.artifactId);
    const htmlChunk = stringValue(params.htmlChunk);
    if (!artifactId) return invalidParams('artifactId is required');
    if (!htmlChunk) return invalidParams('htmlChunk is required');
    await artifactService.append(artifactId, htmlChunk);
    return { ok: true, artifactId };
  }

  if (command === 'desktop.artifacts.search') {
    const query = stringValue(params.query)?.toLowerCase();
    const type = optionalArtifactTypeValue(params.type);
    const externalFormat = artifactExternalFormatValue(params.externalFormat);
    const reuseKind = artifactReuseKindValue(params.reuseKind);
    const sourceType = artifactSourceTypeValue(params.sourceType);
    const status = artifactStatusValue(params.status);
    const limit = artifactSearchLimit(params.limit);
    const artifacts = await artifactPersistence.list();
    const results = artifacts
      .filter((artifact) => {
        if (type && artifact.type !== type) return false;
        if (externalFormat && artifact.externalFormat !== externalFormat) return false;
        if (reuseKind && artifact.reuseKind !== reuseKind) return false;
        if (sourceType && artifact.source.type !== sourceType) return false;
        if (status && artifact.status !== status) return false;
        if (query && !buildArtifactSearchText(artifact).includes(query)) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));

    return {
      ok: true,
      count: results.length,
      results: results.slice(0, limit).map(buildArtifactSearchResult),
    };
  }

  if (command === 'desktop.artifacts.describe') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const artifact = await artifactPersistence.loadMeta(artifactId);
    if (!artifact) return { ok: false, error: 'not-found', artifactId };
    const reference = buildArtifactReuseReference(artifact);
    const lastReuseEvent = artifact.reuseEvents?.[artifact.reuseEvents.length - 1];
    const lastExecutionEvent = artifact.executionEvents?.[artifact.executionEvents.length - 1];
    const versions = buildArtifactVersionHistory(artifact);
    const latestVersion = versions[versions.length - 1];
    return {
      ok: true,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        type: artifact.type,
        uri: reference.uri,
        currentVersion: artifact.currentVersion,
        versionCount: versions.length,
        latestVersion,
        status: artifact.status,
        externalFormat: artifact.externalFormat,
        contentSummary: artifact.contentSummary,
        reuseKind: artifact.reuseKind,
        reuseEventCount: artifact.reuseEvents?.length ?? 0,
        lastReuseEvent,
        executionEventCount: artifact.executionEvents?.length ?? 0,
        lastExecutionEvent,
        repositoryOutputPath: artifact.repositoryOutputPath,
        repositoryPreviewPath: artifact.repositoryPreviewPath,
        fileName: artifact.fileName,
        url: artifact.url,
        previewCard: buildArtifactPreviewCard(artifact),
      },
      reference: reference.markdown,
    };
  }

  if (command === 'desktop.artifacts.reuse.record') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const artifact = await artifactPersistence.loadMeta(artifactId);
    if (!artifact) return { ok: false, error: 'not-found', artifactId };

    const usedAt = numberValue(params.usedAt) ?? Date.now();
    const updatedArtifact = recordArtifactReuseEvent(artifact, {
      context: artifactReuseContextValue(params.context),
      status: artifactReuseStatusValue(params.status),
      sourceId: stringValue(params.sourceId),
      sourceName: stringValue(params.sourceName),
      purpose: stringValue(params.purpose),
      resultSummary: stringValue(params.resultSummary),
      usedAt,
    });
    const event = updatedArtifact.reuseEvents?.[updatedArtifact.reuseEvents.length - 1];

    await artifactService.update(artifactId, {
      reuseEvents: updatedArtifact.reuseEvents,
    });
    const persistedArtifact = await artifactPersistence.loadMeta(artifactId);
    const outputArtifact = persistedArtifact
      ? { ...persistedArtifact, reuseEvents: updatedArtifact.reuseEvents }
      : updatedArtifact;

    const repoPath = stringValue(params.repoPath);
    let output: RepositoryOutputResult | null = null;
    if (repoPath) {
      const html = await artifactPersistence.loadHtml(artifactId, outputArtifact.currentVersion);
      output = await createRepositoryOutput({
        binding: createDefaultRepositoryBinding({
          gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
          repoPath,
        }),
        artifact: outputArtifact,
        html: html ?? undefined,
      });
      await recordRepositoryOutput(artifactId, output);
    }

    return {
      ok: true,
      artifactId,
      event,
      ...(output
        ? {
            output: {
              outputId: output.outputId,
              path: output.outputPath,
              previewPath: output.previewPath,
            },
          }
        : {}),
    };
  }

  if (command === 'desktop.artifacts.execution.record') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const artifact = await artifactPersistence.loadMeta(artifactId);
    if (!artifact) return { ok: false, error: 'not-found', artifactId };
    if (!artifact.reuseKind || !ARTIFACT_EXECUTABLE_REUSE_KINDS.has(artifact.reuseKind)) {
      return {
        ok: false,
        error: 'not-executable-artifact',
        artifactId,
        reuseKind: artifact.reuseKind,
      };
    }

    const requestedAt = numberValue(params.requestedAt) ?? Date.now();
    const updatedArtifact = recordArtifactExecutionEvent(artifact, {
      status: artifactExecutionStatusValue(params.status),
      sourceId: stringValue(params.sourceId),
      sourceName: stringValue(params.sourceName),
      runner: stringValue(params.runner),
      command: stringValue(params.command) ?? artifact.command,
      approvalTitle: stringValue(params.approvalTitle),
      approvalRisk: stringValue(params.approvalRisk),
      approvalReason: stringValue(params.approvalReason),
      outputArtifactId: stringValue(params.outputArtifactId),
      repositoryOutputPath: stringValue(params.repositoryOutputPath),
      resultSummary: stringValue(params.resultSummary),
      error: stringValue(params.error),
      requestedAt,
      startedAt: numberValue(params.startedAt),
      endedAt: numberValue(params.endedAt),
    });
    const event = updatedArtifact.executionEvents?.[updatedArtifact.executionEvents.length - 1];

    await artifactService.update(artifactId, {
      executionEvents: updatedArtifact.executionEvents,
    });
    const persistedArtifact = await artifactPersistence.loadMeta(artifactId);
    const outputArtifact = persistedArtifact
      ? { ...persistedArtifact, executionEvents: updatedArtifact.executionEvents }
      : updatedArtifact;

    const repoPath = stringValue(params.repoPath);
    let output: RepositoryOutputResult | null = null;
    if (repoPath) {
      const html = await artifactPersistence.loadHtml(artifactId, outputArtifact.currentVersion);
      output = await createRepositoryOutput({
        binding: createDefaultRepositoryBinding({
          gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
          repoPath,
        }),
        artifact: outputArtifact,
        html: html ?? undefined,
      });
      await recordRepositoryOutput(artifactId, output);
    }

    return {
      ok: true,
      artifactId,
      event,
      ...(output
        ? {
            output: {
              outputId: output.outputId,
              path: output.outputPath,
              previewPath: output.previewPath,
            },
          }
        : {}),
    };
  }

  if (command === 'desktop.artifacts.update') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    await artifactService.update(artifactId, {
      title: stringValue(params.title),
      description: stringValue(params.description),
      icon: stringValue(params.icon),
      type: params.type === undefined ? undefined : artifactTypeValue(params.type),
      tags: tagsValue(params.tags),
    });
    return { ok: true, artifactId };
  }

  if (command === 'desktop.artifacts.open') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const version = typeof params.version === 'number' ? params.version : undefined;
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) return { ok: false, error: 'not-found', artifactId };
    await artifactPersistence.openWindow(artifactId, version ?? meta.currentVersion);
    return { ok: true, artifactId };
  }

  return { ok: false, error: 'unsupported-command', command };
}
