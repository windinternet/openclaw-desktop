import type { ArtifactMeta } from './artifact-types';
import type { RepositoryBinding } from './agentic-repository';
import { loadRepositoryBinding } from './agentic-repository-store';
import { buildArtifactVersionHistory } from './artifact-version-history';
import { buildArtifactPreviewCard } from './artifact-display';

export interface CreateRepositoryOutputParams {
  binding: RepositoryBinding;
  artifact: ArtifactMeta;
  html?: string;
}

export interface RepositoryOutputResult {
  outputId: string;
  outputPath: string;
  previewPath?: string;
}

export type ArtifactRepositoryOutputUpdates = Pick<ArtifactMeta, 'repositoryOutputPath' | 'repositoryPreviewPath'>;

const TYPE_DIR: Record<string, string> = {
  report: 'reports',
  dashboard: 'dashboards',
  analysis: 'analyses',
  checklist: 'checklists',
  code: 'code',
  document: 'documents',
  slide: 'slides',
  form: 'forms',
  other: 'other',
  file: 'files',
  image: 'media',
  video: 'media',
  audio: 'media',
  link: 'links',
  app: 'apps',
};

export function buildOutputMarkdown(artifact: ArtifactMeta, previewPath?: string): string {
  const runtimeAuthEvents = artifact.authEvents ?? [];
  const lastRuntimeAuth = runtimeAuthEvents[runtimeAuthEvents.length - 1];
  const runtimeBridgeEvents = artifact.bridgeEvents ?? [];
  const lastRuntimeBridge = runtimeBridgeEvents[runtimeBridgeEvents.length - 1];
  const reuseEvents = artifact.reuseEvents ?? [];
  const lastReuseEvent = reuseEvents[reuseEvents.length - 1];
  const executionEvents = artifact.executionEvents ?? [];
  const lastExecutionEvent = executionEvents[executionEvents.length - 1];
  const versions = buildArtifactVersionHistory(artifact);
  const latestVersion = versions[versions.length - 1];
  const previewCard = buildArtifactPreviewCard(artifact);

  return [
    `# ${artifact.title}`,
    '',
    `artifactId: ${artifact.id}`,
    `type: ${artifact.type}`,
    `status: ${artifact.status}`,
    `version: ${artifact.currentVersion}`,
    versions.length > 0 ? `versionCount: ${versions.length}` : undefined,
    latestVersion ? `latestVersionLabel: ${latestVersion.label}` : undefined,
    latestVersion ? `latestVersionCreatedBy: ${latestVersion.createdBy}` : undefined,
    latestVersion ? `latestVersionAt: ${new Date(latestVersion.createdAt).toISOString()}` : undefined,
    `updatedAt: ${new Date(artifact.updatedAt).toISOString()}`,
    `sourceType: ${artifact.source.type}`,
    artifact.source.id ? `sourceId: ${artifact.source.id}` : undefined,
    artifact.source.name ? `sourceName: ${artifact.source.name}` : undefined,
    artifact.externalFormat ? `externalFormat: ${artifact.externalFormat}` : undefined,
    artifact.contentSummary ? `contentSummary: ${artifact.contentSummary}` : undefined,
    artifact.fileInspection ? `fileInspectionFormat: ${artifact.fileInspection.format}` : undefined,
    artifact.fileInspection ? `fileInspectionSource: ${artifact.fileInspection.sourceKind}` : undefined,
    artifact.fileInspection ? `fileInspectionOpen: ${artifact.fileInspection.openBehavior}` : undefined,
    artifact.fileInspection ? `fileInspectionPreview: ${artifact.fileInspection.previewStatus}` : undefined,
    artifact.fileInspection ? `fileInspectionSummary: ${artifact.fileInspection.summary}` : undefined,
    artifact.fileInspection?.limitations.length
      ? `fileInspectionLimitations: ${artifact.fileInspection.limitations.join(', ')}`
      : undefined,
    artifact.fileInspection
      ? `fileInspectionAt: ${new Date(artifact.fileInspection.inspectedAt).toISOString()}`
      : undefined,
    artifact.contentExtract ? `contentExtractStatus: ${artifact.contentExtract.status}` : undefined,
    artifact.contentExtract ? `contentExtractFormat: ${artifact.contentExtract.format}` : undefined,
    artifact.contentExtract ? `contentExtractSource: ${artifact.contentExtract.sourceKind}` : undefined,
    artifact.contentExtract ? `contentExtractSummary: ${artifact.contentExtract.summary}` : undefined,
    artifact.contentExtract?.fileName ? `contentExtractFileName: ${artifact.contentExtract.fileName}` : undefined,
    artifact.contentExtract?.mimeType ? `contentExtractMimeType: ${artifact.contentExtract.mimeType}` : undefined,
    artifact.contentExtract ? `contentExtractBytes: ${artifact.contentExtract.bytesRead}` : undefined,
    artifact.contentExtract ? `contentExtractTextLength: ${artifact.contentExtract.textLength}` : undefined,
    artifact.contentExtract ? `contentExtractTruncated: ${artifact.contentExtract.truncated}` : undefined,
    artifact.contentExtract ? `contentExtractSnippet: ${formatInlineText(artifact.contentExtract.snippet)}` : undefined,
    artifact.contentExtract
      ? `contentExtractAt: ${new Date(artifact.contentExtract.extractedAt).toISOString()}`
      : undefined,
    `previewCardFormat: ${previewCard.formatLabel}`,
    `previewCardThumbnail: ${previewCard.thumbnailLabel}`,
    `previewCardSummary: ${previewCard.summary}`,
    previewCard.location ? `previewCardLocation: ${previewCard.location}` : undefined,
    `previewCardAction: ${previewCard.primaryAction}`,
    previewCard.safetyNote ? `previewCardSafety: ${previewCard.safetyNote}` : undefined,
    artifact.previewPlan ? `previewPlanStrategy: ${artifact.previewPlan.strategy}` : undefined,
    artifact.previewPlan ? `previewPlanSurface: ${artifact.previewPlan.surface}` : undefined,
    artifact.previewPlan ? `previewPlanAction: ${artifact.previewPlan.primaryAction}` : undefined,
    artifact.previewPlan ? `previewPlanSummary: ${artifact.previewPlan.summary}` : undefined,
    artifact.previewPlan?.safetyNote ? `previewPlanSafety: ${artifact.previewPlan.safetyNote}` : undefined,
    artifact.previewPlan?.limitations.length
      ? `previewPlanLimitations: ${artifact.previewPlan.limitations.join(', ')}`
      : undefined,
    artifact.previewPlan?.nextSteps.length
      ? `previewPlanNextSteps: ${artifact.previewPlan.nextSteps.join(', ')}`
      : undefined,
    artifact.previewPlan ? `previewPlanAt: ${new Date(artifact.previewPlan.plannedAt).toISOString()}` : undefined,
    artifact.reuseKind ? `reuseKind: ${artifact.reuseKind}` : undefined,
    artifact.htmlAudit ? `htmlSelfContained: ${artifact.htmlAudit.selfContained}` : undefined,
    artifact.htmlAudit ? `htmlRequiresApproval: ${artifact.htmlAudit.requiresApproval}` : undefined,
    artifact.htmlAudit ? `htmlIssueCount: ${artifact.htmlAudit.issues.length}` : undefined,
    runtimeAuthEvents.length > 0 ? `runtimeAuthCount: ${runtimeAuthEvents.length}` : undefined,
    lastRuntimeAuth ? `runtimeAuthLastCapability: ${lastRuntimeAuth.capability}` : undefined,
    lastRuntimeAuth ? `runtimeAuthLastGranted: ${lastRuntimeAuth.granted}` : undefined,
    lastRuntimeAuth ? `runtimeAuthLastLevel: ${lastRuntimeAuth.level}` : undefined,
    lastRuntimeAuth ? `runtimeAuthLastAt: ${new Date(lastRuntimeAuth.decidedAt).toISOString()}` : undefined,
    runtimeBridgeEvents.length > 0 ? `runtimeBridgeCallCount: ${runtimeBridgeEvents.length}` : undefined,
    lastRuntimeBridge ? `runtimeBridgeLastMethod: ${lastRuntimeBridge.method}` : undefined,
    lastRuntimeBridge ? `runtimeBridgeLastStatus: ${lastRuntimeBridge.status}` : undefined,
    lastRuntimeBridge?.resultSummary ? `runtimeBridgeLastResult: ${lastRuntimeBridge.resultSummary}` : undefined,
    lastRuntimeBridge?.error ? `runtimeBridgeLastError: ${lastRuntimeBridge.error}` : undefined,
    lastRuntimeBridge ? `runtimeBridgeLastAt: ${new Date(lastRuntimeBridge.endedAt).toISOString()}` : undefined,
    reuseEvents.length > 0 ? `reuseEventCount: ${reuseEvents.length}` : undefined,
    lastReuseEvent ? `reuseLastContext: ${lastReuseEvent.context}` : undefined,
    lastReuseEvent?.sourceId ? `reuseLastSourceId: ${lastReuseEvent.sourceId}` : undefined,
    lastReuseEvent?.sourceName ? `reuseLastSourceName: ${lastReuseEvent.sourceName}` : undefined,
    lastReuseEvent ? `reuseLastStatus: ${lastReuseEvent.status}` : undefined,
    lastReuseEvent?.purpose ? `reuseLastPurpose: ${lastReuseEvent.purpose}` : undefined,
    lastReuseEvent?.resultSummary ? `reuseLastResult: ${lastReuseEvent.resultSummary}` : undefined,
    lastReuseEvent ? `reuseLastArtifactVersion: ${lastReuseEvent.artifactVersion}` : undefined,
    lastReuseEvent ? `reuseLastAt: ${new Date(lastReuseEvent.usedAt).toISOString()}` : undefined,
    executionEvents.length > 0 ? `executionEventCount: ${executionEvents.length}` : undefined,
    lastExecutionEvent ? `executionLastStatus: ${lastExecutionEvent.status}` : undefined,
    lastExecutionEvent?.sourceId ? `executionLastSourceId: ${lastExecutionEvent.sourceId}` : undefined,
    lastExecutionEvent?.sourceName ? `executionLastSourceName: ${lastExecutionEvent.sourceName}` : undefined,
    lastExecutionEvent?.runner ? `executionLastRunner: ${lastExecutionEvent.runner}` : undefined,
    lastExecutionEvent?.command ? `executionLastCommand: ${lastExecutionEvent.command}` : undefined,
    lastExecutionEvent?.approvalTitle ? `executionLastApprovalTitle: ${lastExecutionEvent.approvalTitle}` : undefined,
    lastExecutionEvent?.approvalRisk ? `executionLastApprovalRisk: ${lastExecutionEvent.approvalRisk}` : undefined,
    lastExecutionEvent?.resultSummary ? `executionLastResult: ${lastExecutionEvent.resultSummary}` : undefined,
    lastExecutionEvent?.error ? `executionLastError: ${lastExecutionEvent.error}` : undefined,
    lastExecutionEvent?.outputArtifactId
      ? `executionLastOutputArtifact: ${lastExecutionEvent.outputArtifactId}`
      : undefined,
    lastExecutionEvent?.repositoryOutputPath
      ? `executionLastRepositoryOutput: ${lastExecutionEvent.repositoryOutputPath}`
      : undefined,
    lastExecutionEvent ? `executionLastArtifactVersion: ${lastExecutionEvent.artifactVersion}` : undefined,
    lastExecutionEvent?.endedAt ? `executionLastAt: ${new Date(lastExecutionEvent.endedAt).toISOString()}` : undefined,
    artifact.fileName ? `fileName: ${artifact.fileName}` : undefined,
    artifact.filePath ? `filePath: ${artifact.filePath}` : undefined,
    artifact.originalFilePath ? `originalFilePath: ${artifact.originalFilePath}` : undefined,
    artifact.fileSize !== undefined ? `fileSize: ${artifact.fileSize}` : undefined,
    artifact.mimeType ? `mimeType: ${artifact.mimeType}` : undefined,
    previewPath ? `preview: ${previewPath}` : undefined,
    artifact.description ? `description: ${artifact.description}` : undefined,
    artifact.tags.length > 0 ? `tags: ${artifact.tags.join(', ')}` : undefined,
    '',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

export async function createRepositoryOutput(params: CreateRepositoryOutputParams): Promise<RepositoryOutputResult> {
  const repository = getRepositoryWriteApi();
  const bucket = TYPE_DIR[params.artifact.type] ?? 'html';
  const outputPath = `${params.binding.paths.outputs}/${bucket}/${params.artifact.id}.md`;
  const previewPath = params.html ? `${params.binding.paths.outputs}/html/${params.artifact.id}.html` : undefined;

  if (previewPath && params.html) {
    await repository.writeText(params.binding.repoPath, previewPath, params.html);
  }

  await repository.writeText(params.binding.repoPath, outputPath, buildOutputMarkdown(params.artifact, previewPath));

  const indexPath = `${params.binding.paths.outputs}/index.md`;
  const existingIndex = await repository.readText(params.binding.repoPath, indexPath);
  const nextIndex = upsertOutputIndexEntry(
    existingIndex,
    outputPath,
    buildOutputIndexEntry(params.artifact, outputPath, previewPath),
  );
  await repository.writeText(params.binding.repoPath, indexPath, nextIndex);

  return { outputId: params.artifact.id, outputPath, previewPath };
}

export function buildArtifactRepositoryOutputUpdates(output: RepositoryOutputResult): ArtifactRepositoryOutputUpdates {
  return {
    repositoryOutputPath: output.outputPath,
    repositoryPreviewPath: output.previewPath,
  };
}

export async function mirrorArtifactToReadyRepositoryOutput(
  instanceId: string,
  artifact: ArtifactMeta,
  html?: string,
): Promise<RepositoryOutputResult | null> {
  const binding = await loadRepositoryBinding(instanceId);
  if (!binding || binding.status !== 'repo_ready' || binding.location !== 'desktop-local') return null;

  return createRepositoryOutput({
    binding,
    artifact,
    html,
  });
}

function buildOutputIndexEntry(artifact: ArtifactMeta, outputPath: string, previewPath?: string): string {
  const previewCard = buildArtifactPreviewCard(artifact);
  const executionCount = artifact.executionEvents?.length ?? 0;
  const lastExecutionEvent = artifact.executionEvents?.[executionCount - 1];
  return [
    `- [${artifact.title}](${outputPath}) (\`${artifact.id}\`, ${artifact.type}, ${artifact.status})`,
    `  - artifact: artifact://${artifact.id}`,
    `  - source: ${formatArtifactSource(artifact)}`,
    `  - updatedAt: ${new Date(artifact.updatedAt).toISOString()}`,
    previewPath ? `  - preview: ${previewPath}` : undefined,
    artifact.externalFormat ? `  - format: ${artifact.externalFormat}` : undefined,
    artifact.contentSummary ? `  - summary: ${artifact.contentSummary}` : undefined,
    artifact.contentExtract
      ? `  - contentExtract: ${artifact.contentExtract.status}, ${artifact.contentExtract.textLength} chars${
          artifact.contentExtract.truncated ? ', truncated' : ''
        }`
      : undefined,
    artifact.fileInspection
      ? `  - inspection: ${artifact.fileInspection.sourceKind}, ${artifact.fileInspection.previewStatus}`
      : undefined,
    artifact.previewPlan
      ? `  - previewPlan: ${artifact.previewPlan.strategy}, ${artifact.previewPlan.primaryAction}`
      : undefined,
    `  - previewCard: ${previewCard.thumbnailLabel} · ${previewCard.actionLabel}`,
    artifact.reuseKind ? `  - reuseKind: ${artifact.reuseKind}` : undefined,
    lastExecutionEvent ? `  - execution: ${executionCount} events, last ${lastExecutionEvent.status}` : undefined,
    artifact.tags.length > 0 ? `  - tags: ${artifact.tags.join(', ')}` : undefined,
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

function upsertOutputIndexEntry(existingIndex: string, outputPath: string, indexEntry: string): string {
  const lines = existingIndex.trimEnd().split('\n');
  const start = lines.findIndex((line) => line.includes(outputPath));
  if (start === -1) {
    const base = existingIndex.trimEnd();
    return base ? `${base}\n${indexEntry}\n` : `${indexEntry}\n`;
  }

  let end = start + 1;
  while (end < lines.length && lines[end].startsWith('  - ')) end += 1;

  return [...lines.slice(0, start), ...indexEntry.split('\n'), ...lines.slice(end)].join('\n').trimEnd() + '\n';
}

function formatArtifactSource(artifact: ArtifactMeta): string {
  return [artifact.source.type, artifact.source.id, artifact.source.name]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' / ');
}

function formatInlineText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\\n');
}

function getRepositoryWriteApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.writeText || !repository.readText) {
    throw new Error('electronAPI.repository output methods not available');
  }
  return {
    writeText: repository.writeText,
    readText: repository.readText,
  };
}
