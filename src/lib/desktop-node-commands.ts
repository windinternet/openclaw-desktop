import type {
  ArtifactContentFacts,
  ArtifactContentExtract,
  ArtifactExecutionStatus,
  ArtifactExternalFormat,
  ArtifactFileInspection,
  ArtifactMeta,
  ArtifactPreviewPlan,
  ArtifactReuseContext,
  ArtifactReuseKind,
  ArtifactReuseStatus,
  ArtifactType,
} from './artifact-types';
import { artifactService, type GenerateParams } from './artifact-service';
import { artifactPersistence } from './artifact-persistence';
import { buildArtifactAgentPreviewCard, buildArtifactSearchText } from './artifact-display';
import { buildArtifactContentFacts, resolveArtifactContentFactsEligibility } from './artifact-content-facts';
import { buildArtifactContentExtract, resolveArtifactContentExtractEligibility } from './artifact-content-extract';
import { recordArtifactEnrichmentEvent } from './artifact-enrichment-events';
import { buildArtifactFileInspection, shouldInspectArtifactFile } from './artifact-file-inspection';
import { buildArtifactPreviewPlan } from './artifact-preview-plan';
import { buildArtifactThumbnail, resolveArtifactThumbnailEligibility } from './artifact-thumbnail';
import { buildArtifactReuseReference } from './artifact-reference';
import { buildArtifactValueHealth } from './artifact-value-health';
import { buildArtifactExecutionReviewSummary } from './artifact-review-clues';
import { recordArtifactExecutionEvent } from './artifact-execution-record';
import { recordArtifactReuseEvent } from './artifact-reuse-record';
import { buildArtifactVersionHistory } from './artifact-version-history';
import { createDefaultRepositoryBinding, getRepositoryGateStatus } from './agentic-repository';
import {
  buildArtifactRepositoryOutputUpdates,
  createRepositoryOutput,
  recordRepositoryAssetIndexEntry,
  recordRepositoryAssetExecution,
  searchRepositoryAssetIndex,
  type RepositoryOutputResult,
} from './repository-outputs';
import { writeWorkbenchAssetRunReviewDraft } from './repository-workbench';

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

function dateValue(value: unknown): Date | undefined {
  const number = numberValue(value);
  if (number !== undefined) return new Date(number);
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
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

function formatReviewDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildArtifactExecutionReviewMarkdown(params: {
  artifact: ArtifactMeta;
  reviewedAt: Date;
  reviewer?: string;
  reviewSummary: string;
  reuseDecision?: string;
  workItemPath?: string;
  nextActions: string[];
}): string {
  const lastExecutionEvent = params.artifact.executionEvents?.[params.artifact.executionEvents.length - 1];
  const date = formatReviewDate(params.reviewedAt);
  const lines = [
    '---',
    `title: ${JSON.stringify(`可复用资产执行复盘 ${date} - ${params.artifact.title}`)}`,
    'source: desktop-artifact-execution-review',
    `artifactId: ${params.artifact.id}`,
    `artifactUri: artifact://${params.artifact.id}`,
    params.artifact.reuseKind ? `artifactReuseKind: ${params.artifact.reuseKind}` : undefined,
    lastExecutionEvent ? `executionStatus: ${lastExecutionEvent.status}` : undefined,
    `reviewedAt: ${params.reviewedAt.toISOString()}`,
    params.reviewer ? `reviewer: ${params.reviewer}` : undefined,
    params.workItemPath ? `workItemPath: ${params.workItemPath}` : undefined,
    lastExecutionEvent?.outputArtifactId ? `outputArtifactId: ${lastExecutionEvent.outputArtifactId}` : undefined,
    lastExecutionEvent?.repositoryOutputPath
      ? `repositoryOutputPath: ${lastExecutionEvent.repositoryOutputPath}`
      : undefined,
    '---',
    '',
    `# 可复用资产执行复盘：${params.artifact.title}`,
    '',
    '## 摘要',
    '',
    `- Artifact: artifact://${params.artifact.id}`,
    params.artifact.reuseKind ? `- 复用分类：${params.artifact.reuseKind}` : undefined,
    lastExecutionEvent ? `- 最近执行：${lastExecutionEvent.status}` : undefined,
    lastExecutionEvent?.runner ? `- 运行器：${lastExecutionEvent.runner}` : undefined,
    lastExecutionEvent?.command ? `- 命令：\`${lastExecutionEvent.command}\`` : undefined,
    lastExecutionEvent?.resultSummary ? `- 执行结果：${lastExecutionEvent.resultSummary}` : undefined,
    lastExecutionEvent?.outputArtifactId ? `- 输出产物：artifact://${lastExecutionEvent.outputArtifactId}` : undefined,
    lastExecutionEvent?.repositoryOutputPath ? `- 仓库输出：${lastExecutionEvent.repositoryOutputPath}` : undefined,
    params.workItemPath ? `- 关联事项：${params.workItemPath}` : undefined,
    '',
    '## 复盘记录',
    '',
    params.reviewSummary,
    '',
    '## 复用判断',
    '',
    params.reuseDecision || '待补充。',
    '',
    '## 后续动作',
    '',
    ...(params.nextActions.length > 0
      ? params.nextActions.map((action) => `- [ ] ${action}`)
      : ['- [ ] 记录复用判断。']),
    '',
    '## 边界',
    '',
    '- Desktop 只写入复盘记录，不执行工具、脚本或工作流。',
    '- Desktop 不授予执行权限，不替代用户审批。',
    '',
  ].filter((line): line is string => line !== undefined);

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
  const fileInspection = artifact.fileInspection;
  const contentExtract = artifact.contentExtract;
  const contentFacts = artifact.contentFacts;
  const previewPlan = artifact.previewPlan;
  const valueHealth = buildArtifactValueHealth(artifact);
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
    fileInspection,
    contentExtract,
    contentFacts,
    previewPlan,
    valueHealth,
    previewCard: buildArtifactAgentPreviewCard(artifact),
    executionEventCount: artifact.executionEvents?.length ?? 0,
    lastExecutionEvent,
    assetExecutionSummary: buildArtifactAssetExecutionSummary(artifact),
    updatedAt: artifact.updatedAt,
    reference: reference.markdown,
  };
}

function buildArtifactAssetExecutionSummary(artifact: ArtifactMeta) {
  if (!artifact.reuseKind && !artifact.executionEvents?.length) return undefined;

  const executionEvents = artifact.executionEvents ?? [];
  const lastExecutionEvent = executionEvents[executionEvents.length - 1];
  const executable = artifact.reuseKind ? ARTIFACT_EXECUTABLE_REUSE_KINDS.has(artifact.reuseKind) : false;
  const summary = {
    reuseKind: artifact.reuseKind,
    executable,
    requiresApprovalBeforeRun: executable,
    executionEventCount: executionEvents.length,
    ...(lastExecutionEvent
      ? {
          latestStatus: lastExecutionEvent.status,
          latestApprovalTitle: lastExecutionEvent.approvalTitle,
          latestApprovalRisk: lastExecutionEvent.approvalRisk,
          latestApprovalReason: lastExecutionEvent.approvalReason,
          latestRunner: lastExecutionEvent.runner,
          latestCommand: lastExecutionEvent.command,
          latestResultSummary: lastExecutionEvent.resultSummary,
          latestOutputArtifactId: lastExecutionEvent.outputArtifactId,
          latestRepositoryOutputPath: lastExecutionEvent.repositoryOutputPath,
          reviewSummary: buildArtifactExecutionReviewSummary(artifact),
        }
      : {}),
    ...(executable
      ? {
          boundary: {
            recordOnly: true,
            desktopExecutes: false,
            grantsPermission: false,
          },
        }
      : {}),
  };

  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined));
}

async function mirrorArtifactSnapshotToRepository(params: {
  artifactId: string;
  artifact: ArtifactMeta;
  repoPath: string;
  gatewayInstanceId?: string;
}): Promise<RepositoryOutputResult> {
  const html = await artifactPersistence.loadHtml(params.artifactId, params.artifact.currentVersion);
  const output = await createRepositoryOutput({
    binding: createDefaultRepositoryBinding({
      gatewayInstanceId: params.gatewayInstanceId ?? 'desktop-node',
      repoPath: params.repoPath,
    }),
    artifact: params.artifact,
    html: html ?? undefined,
  });
  await recordRepositoryOutput(params.artifactId, output);
  return output;
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

  if (command === 'desktop.repository.assets.record') {
    const repoPath = stringValue(params.repoPath);
    const title = stringValue(params.title);
    const relativePath = stringValue(params.path);
    const reuseKind = artifactReuseKindValue(params.reuseKind);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!title) return invalidParams('title is required');
    if (!relativePath) return invalidParams('path is required');
    if (!reuseKind) return invalidParams('reuseKind is required');

    const asset = await recordRepositoryAssetIndexEntry({
      binding: createDefaultRepositoryBinding({
        gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
        repoPath,
      }),
      id: stringValue(params.id),
      title,
      path: relativePath,
      reuseKind,
      source: stringValue(params.source) ?? 'repository-manual',
      version: stringValue(params.version),
      summary: stringValue(params.summary),
      tags: tagsValue(params.tags),
      updatedAt: dateValue(params.updatedAt),
    });

    return { ok: true, asset };
  }

  if (command === 'desktop.repository.assets.search') {
    const repoPath = stringValue(params.repoPath);
    const reuseKind = artifactReuseKindValue(params.reuseKind);
    if (!repoPath) return invalidParams('repoPath is required');

    const assets = await searchRepositoryAssetIndex({
      binding: createDefaultRepositoryBinding({
        gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
        repoPath,
      }),
      query: stringValue(params.query),
      reuseKind,
      limit: numberValue(params.limit),
    });

    return { ok: true, assets };
  }

  if (command === 'desktop.repository.assets.execution.record') {
    const repoPath = stringValue(params.repoPath);
    const assetId = stringValue(params.assetId);
    const relativePath = stringValue(params.path);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!assetId && !relativePath) return invalidParams('assetId or path is required');

    const execution = await recordRepositoryAssetExecution({
      binding: createDefaultRepositoryBinding({
        gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
        repoPath,
      }),
      assetId,
      path: relativePath,
      status: artifactExecutionStatusValue(params.status),
      runner: stringValue(params.runner),
      command: stringValue(params.command),
      resultSummary: stringValue(params.resultSummary),
      outputArtifactId: stringValue(params.outputArtifactId),
      repositoryOutputPath: stringValue(params.repositoryOutputPath),
      workItemPath: stringValue(params.workItemPath),
      executedAt: dateValue(params.executedAt),
    });

    return { ok: true, execution };
  }

  if (command === 'desktop.repository.assets.execution.review.write') {
    const repoPath = stringValue(params.repoPath);
    const assetRunPath = stringValue(params.assetRunPath);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!assetRunPath) return invalidParams('assetRunPath is required');
    const repository = repositoryApi();
    if (!repository?.readText || !repository.writeText) return { ok: false, error: 'repository-api-unavailable' };

    const draft = await writeWorkbenchAssetRunReviewDraft(
      createDefaultRepositoryBinding({
        gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
        repoPath,
      }),
      {
        assetRunPath,
        workItemPath: stringValue(params.workItemPath),
        reviewSummary: stringValue(params.reviewSummary) ?? stringValue(params.summary),
        reuseDecision: stringValue(params.reuseDecision),
        nextActions: stringArrayValue(params.nextActions),
        reviewer: stringValue(params.reviewer),
        createdAt: dateValue(params.reviewedAt) ?? new Date(),
      },
    );

    return {
      ok: true,
      assetRunPath,
      path: draft.path,
      boundary: {
        recordOnly: true,
        desktopExecutes: false,
        grantsPermission: false,
      },
    };
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

  if (command === 'desktop.artifacts.inspect') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const artifact = await artifactPersistence.loadMeta(artifactId);
    if (!artifact) return { ok: false, error: 'not-found', artifactId };
    if (!shouldInspectArtifactFile(artifact)) {
      return { ok: false, error: 'not-file-like-artifact', artifactId, type: artifact.type };
    }

    const inspectedAt = numberValue(params.inspectedAt) ?? Date.now();
    const inspection: ArtifactFileInspection = buildArtifactFileInspection(artifact, inspectedAt);
    const previewPlan: ArtifactPreviewPlan = buildArtifactPreviewPlan(
      { ...artifact, fileInspection: inspection },
      inspectedAt,
    );
    await artifactService.update(artifactId, {
      fileInspection: inspection,
      previewPlan,
    });
    const persistedArtifact = await artifactPersistence.loadMeta(artifactId);
    const outputArtifact = persistedArtifact
      ? { ...persistedArtifact, fileInspection: inspection, previewPlan }
      : { ...artifact, fileInspection: inspection, previewPlan };

    const repoPath = stringValue(params.repoPath);
    let output: RepositoryOutputResult | null = null;
    if (repoPath) {
      output = await mirrorArtifactSnapshotToRepository({
        artifactId,
        artifact: outputArtifact,
        repoPath,
        gatewayInstanceId: stringValue(params.gatewayInstanceId),
      });
    }

    return {
      ok: true,
      artifactId,
      inspection,
      previewPlan,
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

  if (command === 'desktop.artifacts.content.extract') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const artifact = await artifactPersistence.loadMeta(artifactId);
    if (!artifact) return { ok: false, error: 'not-found', artifactId };

    const eligibility = resolveArtifactContentExtractEligibility(artifact);
    if (!eligibility.eligible) {
      const enrichmentEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'content_extract',
        status: 'unavailable',
        format: eligibility.format,
        attemptedAt: numberValue(params.extractedAt) ?? Date.now(),
        reason: eligibility.reason,
      }).enrichmentEvents;
      await artifactService.update(artifactId, { enrichmentEvents });
      return {
        ok: false,
        error: 'content-extract-unavailable',
        artifactId,
        format: eligibility.format,
        reason: eligibility.reason,
      };
    }

    const attemptedAt = numberValue(params.extractedAt) ?? Date.now();
    let extract: ArtifactContentExtract;
    let enrichmentEvents: ArtifactMeta['enrichmentEvents'];
    try {
      const read = await artifactPersistence.readImportedText(artifactId);
      extract = buildArtifactContentExtract(artifact, read, attemptedAt);
      enrichmentEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'content_extract',
        status: 'succeeded',
        format: extract.format,
        attemptedAt,
        resultSummary: extract.summary,
      }).enrichmentEvents;
    } catch (error) {
      const failedEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'content_extract',
        status: 'failed',
        format: eligibility.format,
        attemptedAt,
        error: error instanceof Error ? error.message : String(error),
      }).enrichmentEvents;
      await artifactService.update(artifactId, { enrichmentEvents: failedEvents });
      return {
        ok: false,
        error: 'content-extract-failed',
        artifactId,
        message: error instanceof Error ? error.message : String(error),
      };
    }

    await artifactService.update(artifactId, {
      contentExtract: extract,
      enrichmentEvents,
    });
    const persistedArtifact = await artifactPersistence.loadMeta(artifactId);
    const outputArtifact = persistedArtifact
      ? { ...persistedArtifact, contentExtract: extract }
      : { ...artifact, contentExtract: extract };
    outputArtifact.enrichmentEvents = enrichmentEvents;

    const repoPath = stringValue(params.repoPath);
    let output: RepositoryOutputResult | null = null;
    if (repoPath) {
      output = await mirrorArtifactSnapshotToRepository({
        artifactId,
        artifact: outputArtifact,
        repoPath,
        gatewayInstanceId: stringValue(params.gatewayInstanceId),
      });
    }

    return {
      ok: true,
      artifactId,
      extract,
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

  if (command === 'desktop.artifacts.content.facts.extract') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const artifact = await artifactPersistence.loadMeta(artifactId);
    if (!artifact) return { ok: false, error: 'not-found', artifactId };

    const eligibility = resolveArtifactContentFactsEligibility(artifact);
    if (!eligibility.eligible) {
      const enrichmentEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'content_facts',
        status: 'unavailable',
        format: eligibility.format,
        attemptedAt: numberValue(params.extractedAt) ?? Date.now(),
        reason: eligibility.reason,
      }).enrichmentEvents;
      await artifactService.update(artifactId, { enrichmentEvents });
      return {
        ok: false,
        error: 'content-facts-unavailable',
        artifactId,
        format: eligibility.format,
        reason: eligibility.reason,
      };
    }

    const attemptedAt = numberValue(params.extractedAt) ?? Date.now();
    let facts: ArtifactContentFacts;
    let enrichmentEvents: ArtifactMeta['enrichmentEvents'];
    try {
      const read = await artifactPersistence.readImportedFileFacts(artifactId);
      facts = buildArtifactContentFacts(artifact, read, attemptedAt);
      enrichmentEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'content_facts',
        status: 'succeeded',
        format: facts.format,
        attemptedAt,
        resultSummary: facts.summary,
      }).enrichmentEvents;
    } catch (error) {
      const failedEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'content_facts',
        status: 'failed',
        format: eligibility.format,
        attemptedAt,
        error: error instanceof Error ? error.message : String(error),
      }).enrichmentEvents;
      await artifactService.update(artifactId, { enrichmentEvents: failedEvents });
      return {
        ok: false,
        error: 'content-facts-failed',
        artifactId,
        message: error instanceof Error ? error.message : String(error),
      };
    }

    await artifactService.update(artifactId, {
      contentFacts: facts,
      enrichmentEvents,
    });
    const persistedArtifact = await artifactPersistence.loadMeta(artifactId);
    const outputArtifact = persistedArtifact
      ? { ...persistedArtifact, contentFacts: facts }
      : { ...artifact, contentFacts: facts };
    outputArtifact.enrichmentEvents = enrichmentEvents;

    const repoPath = stringValue(params.repoPath);
    let output: RepositoryOutputResult | null = null;
    if (repoPath) {
      output = await mirrorArtifactSnapshotToRepository({
        artifactId,
        artifact: outputArtifact,
        repoPath,
        gatewayInstanceId: stringValue(params.gatewayInstanceId),
      });
    }

    return {
      ok: true,
      artifactId,
      facts,
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

  if (command === 'desktop.artifacts.thumbnail.extract') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const artifact = await artifactPersistence.loadMeta(artifactId);
    if (!artifact) return { ok: false, error: 'not-found', artifactId };

    const eligibility = resolveArtifactThumbnailEligibility(artifact);
    if (!eligibility.eligible) {
      const enrichmentEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'thumbnail',
        status: 'unavailable',
        format: eligibility.format,
        attemptedAt: numberValue(params.extractedAt) ?? Date.now(),
        reason: eligibility.reason,
      }).enrichmentEvents;
      await artifactService.update(artifactId, { enrichmentEvents });
      return {
        ok: false,
        error: 'thumbnail-unavailable',
        artifactId,
        format: eligibility.format,
        reason: eligibility.reason,
      };
    }

    const attemptedAt = numberValue(params.extractedAt) ?? Date.now();
    let thumbnail: string | undefined;
    let enrichmentEvents: ArtifactMeta['enrichmentEvents'];
    try {
      const read = await artifactPersistence.readImportedImageThumbnail(artifactId);
      thumbnail = buildArtifactThumbnail(artifact, read);
    } catch (error) {
      const failedEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'thumbnail',
        status: 'failed',
        format: eligibility.format,
        attemptedAt,
        error: error instanceof Error ? error.message : String(error),
      }).enrichmentEvents;
      await artifactService.update(artifactId, { enrichmentEvents: failedEvents });
      return {
        ok: false,
        error: 'thumbnail-failed',
        artifactId,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (!thumbnail) {
      const failedEvents = recordArtifactEnrichmentEvent(artifact, {
        kind: 'thumbnail',
        status: 'failed',
        format: eligibility.format,
        attemptedAt,
        error: 'invalid image thumbnail data',
      }).enrichmentEvents;
      await artifactService.update(artifactId, { enrichmentEvents: failedEvents });
      return {
        ok: false,
        error: 'thumbnail-failed',
        artifactId,
        message: 'invalid image thumbnail data',
      };
    }

    const previewPlan = buildArtifactPreviewPlan({ ...artifact, thumbnail }, attemptedAt);
    enrichmentEvents = recordArtifactEnrichmentEvent(artifact, {
      kind: 'thumbnail',
      status: 'succeeded',
      format: eligibility.format,
      attemptedAt,
      resultSummary: 'thumbnail available',
    }).enrichmentEvents;
    await artifactService.update(artifactId, {
      thumbnail,
      previewPlan,
      enrichmentEvents,
    });
    const persistedArtifact = await artifactPersistence.loadMeta(artifactId);
    const outputArtifact = persistedArtifact
      ? { ...persistedArtifact, thumbnail, previewPlan }
      : { ...artifact, thumbnail, previewPlan };
    outputArtifact.enrichmentEvents = enrichmentEvents;

    const repoPath = stringValue(params.repoPath);
    let output: RepositoryOutputResult | null = null;
    if (repoPath) {
      output = await mirrorArtifactSnapshotToRepository({
        artifactId,
        artifact: outputArtifact,
        repoPath,
        gatewayInstanceId: stringValue(params.gatewayInstanceId),
      });
    }

    return {
      ok: true,
      artifactId,
      thumbnail,
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
    const valueHealth = buildArtifactValueHealth(artifact);
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
        fileInspection: artifact.fileInspection,
        previewPlan: artifact.previewPlan,
        contentExtract: artifact.contentExtract,
        contentFacts: artifact.contentFacts,
        valueHealth,
        reuseKind: artifact.reuseKind,
        reuseEventCount: artifact.reuseEvents?.length ?? 0,
        lastReuseEvent,
        executionEventCount: artifact.executionEvents?.length ?? 0,
        lastExecutionEvent,
        assetExecutionSummary: buildArtifactAssetExecutionSummary(artifact),
        repositoryOutputPath: artifact.repositoryOutputPath,
        repositoryPreviewPath: artifact.repositoryPreviewPath,
        fileName: artifact.fileName,
        url: artifact.url,
        previewCard: buildArtifactAgentPreviewCard(artifact),
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

  if (command === 'desktop.artifacts.execution.prepare') {
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
    const commandText = stringValue(params.command) ?? artifact.command;
    const runner = stringValue(params.runner);
    const approvalTitle = stringValue(params.approvalTitle) ?? `准备执行 ${artifact.title}`;
    const approvalRisk = stringValue(params.approvalRisk) ?? 'high';
    const approvalReason =
      stringValue(params.approvalReason) ?? '执行型 Artifact 需要用户明确审批后，外部 runner 才能继续。';
    const updatedArtifact = recordArtifactExecutionEvent(artifact, {
      status: 'approval_required',
      sourceId: stringValue(params.sourceId),
      sourceName: stringValue(params.sourceName),
      runner,
      command: commandText,
      approvalTitle,
      approvalRisk,
      approvalReason,
      requestedAt,
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
      approval: {
        id: event?.id,
        status: 'pending',
        artifactId,
        artifactUri: `artifact://${artifactId}`,
        title: approvalTitle,
        risk: approvalRisk,
        reason: approvalReason,
        runner,
        command: commandText,
        requiresUserApproval: true,
        boundary: {
          recordOnly: true,
          desktopExecutes: false,
          grantsPermission: false,
        },
      },
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

  if (command === 'desktop.artifacts.execution.review.write') {
    const repoPath = stringValue(params.repoPath);
    const artifactId = stringValue(params.artifactId);
    if (!repoPath) return invalidParams('repoPath is required');
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

    const executionReviewSummary = buildArtifactExecutionReviewSummary(artifact);
    if (!executionReviewSummary) return { ok: false, error: 'review-not-ready', artifactId };
    const repository = repositoryApi();
    if (!repository?.writeText) return { ok: false, error: 'repository-api-unavailable' };

    const reviewedAt = dateValue(params.reviewedAt) ?? new Date();
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
      repoPath,
    });
    const relativePath = `${binding.paths.reviews}/weekly/${formatReviewDate(reviewedAt)}-artifact-${slugPathSegment(
      artifactId,
    )}-review.md`;
    const markdown = buildArtifactExecutionReviewMarkdown({
      artifact,
      reviewedAt,
      reviewer: stringValue(params.reviewer),
      reviewSummary:
        stringValue(params.reviewSummary) ??
        stringValue(params.summary) ??
        executionReviewSummary.latestResultSummary ??
        `最近一次执行状态为 ${executionReviewSummary.latestStatus}。`,
      reuseDecision: stringValue(params.reuseDecision),
      workItemPath: stringValue(params.workItemPath),
      nextActions: stringArrayValue(params.nextActions),
    });

    await repository.writeText(repoPath, relativePath, markdown);
    return {
      ok: true,
      artifactId,
      path: relativePath,
      boundary: {
        recordOnly: true,
        desktopExecutes: false,
        grantsPermission: false,
      },
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
