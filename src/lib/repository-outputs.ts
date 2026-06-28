import type { ArtifactExecutionStatus, ArtifactMeta, ArtifactReuseKind } from './artifact-types';
import type { RepositoryBinding } from './agentic-repository';
import { loadRepositoryBinding } from './agentic-repository-store';
import { buildArtifactVersionHistory } from './artifact-version-history';
import { buildArtifactPreviewCard } from './artifact-display';
import { formatArtifactPdfFacts } from './artifact-content-facts';
import { buildArtifactValueHealth } from './artifact-value-health';
import { buildArtifactExecutionReviewSummary } from './artifact-review-clues';

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

export interface RecordRepositoryAssetIndexEntryParams {
  binding: RepositoryBinding;
  title: string;
  path: string;
  reuseKind: ArtifactReuseKind;
  id?: string;
  source?: string;
  version?: string;
  summary?: string;
  tags?: string[];
  updatedAt?: Date | string | number;
}

export interface RepositoryAssetIndexEntryResult {
  indexPath: string;
  assetId: string;
  assetPath: string;
  recordOnly: true;
  desktopExecutes: false;
  grantsPermission: false;
}

export interface SearchRepositoryAssetIndexParams {
  binding: RepositoryBinding;
  query?: string;
  reuseKind?: ArtifactReuseKind;
  limit?: number;
}

export interface RepositoryAssetSearchResult {
  id: string;
  title: string;
  link: string;
  reuseKind: ArtifactReuseKind;
  source?: string;
  path?: string;
  artifactUri?: string;
  output?: string;
  preview?: string;
  version?: string;
  updatedAt?: string;
  summary?: string;
  valueHealth?: string;
  execution?: string;
  lastRun?: string;
  review?: string;
  reviewResult?: string;
  tags: string[];
  boundary: {
    recordOnly: true;
    desktopExecutes: false;
    grantsPermission: false;
  };
}

export interface RepositoryAssetSearchResultSet {
  indexPath: string;
  total: number;
  results: RepositoryAssetSearchResult[];
}

export interface RecordRepositoryAssetExecutionParams {
  binding: RepositoryBinding;
  status: ArtifactExecutionStatus;
  assetId?: string;
  path?: string;
  runner?: string;
  command?: string;
  resultSummary?: string;
  outputArtifactId?: string;
  repositoryOutputPath?: string;
  workItemPath?: string;
  executedAt?: Date | string | number;
}

export interface RepositoryAssetExecutionRecordResult {
  indexPath: string;
  runPath: string;
  runIndexPath: string;
  assetId: string;
  assetPath: string;
  title: string;
  reuseKind: ArtifactReuseKind;
  status: ArtifactExecutionStatus;
  reviewSuggested: boolean;
  reviewTarget?: string;
  recordOnly: true;
  desktopExecutes: false;
  grantsPermission: false;
}

const DEFAULT_REPOSITORY_ASSET_INDEX_PATH = 'outputs/assets/index.md';
const REPOSITORY_ASSET_REUSE_KINDS = new Set<ArtifactReuseKind>(['asset', 'template', 'tool', 'script', 'workflow']);
const EXECUTABLE_REPOSITORY_ASSET_REUSE_KINDS = new Set<ArtifactReuseKind>(['tool', 'script', 'workflow']);
const TERMINAL_ASSET_EXECUTION_STATUSES = new Set<ArtifactExecutionStatus>(['succeeded', 'failed', 'cancelled']);

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
  const enrichmentEvents = artifact.enrichmentEvents ?? [];
  const lastEnrichmentEvent = enrichmentEvents[enrichmentEvents.length - 1];
  const versions = buildArtifactVersionHistory(artifact);
  const latestVersion = versions[versions.length - 1];
  const previewCard = buildArtifactPreviewCard(artifact);
  const valueHealth = buildArtifactValueHealth(artifact);

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
    `createdAt: ${new Date(artifact.createdAt).toISOString()}`,
    `updatedAt: ${new Date(artifact.updatedAt).toISOString()}`,
    `sourceType: ${artifact.source.type}`,
    artifact.source.id ? `sourceId: ${artifact.source.id}` : undefined,
    artifact.source.name ? `sourceName: ${artifact.source.name}` : undefined,
    artifact.externalFormat ? `externalFormat: ${artifact.externalFormat}` : undefined,
    artifact.contentSummary ? `contentSummary: ${artifact.contentSummary}` : undefined,
    artifact.thumbnail ? 'thumbnail: available' : undefined,
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
    artifact.contentFacts ? `contentFactsStatus: ${artifact.contentFacts.status}` : undefined,
    artifact.contentFacts ? `contentFactsFormat: ${artifact.contentFacts.format}` : undefined,
    artifact.contentFacts ? `contentFactsSource: ${artifact.contentFacts.sourceKind}` : undefined,
    artifact.contentFacts ? `contentFactsSummary: ${artifact.contentFacts.summary}` : undefined,
    artifact.contentFacts?.fileName ? `contentFactsFileName: ${artifact.contentFacts.fileName}` : undefined,
    artifact.contentFacts?.mimeType ? `contentFactsMimeType: ${artifact.contentFacts.mimeType}` : undefined,
    artifact.contentFacts?.fileSize !== undefined
      ? `contentFactsFileSize: ${artifact.contentFacts.fileSize}`
      : undefined,
    artifact.contentFacts ? `contentFactsBytes: ${artifact.contentFacts.bytesRead}` : undefined,
    artifact.contentFacts ? `contentFactsSha256: ${artifact.contentFacts.sha256}` : undefined,
    artifact.contentFacts ? `contentFactsSignature: ${artifact.contentFacts.signatureHex}` : undefined,
    artifact.contentFacts?.imageDimensions
      ? `contentFactsImage: ${artifact.contentFacts.imageDimensions.width}x${artifact.contentFacts.imageDimensions.height} ${artifact.contentFacts.imageDimensions.kind}`
      : undefined,
    artifact.contentFacts?.pdfInfo
      ? `contentFactsPdf: ${formatArtifactPdfFacts(artifact.contentFacts.pdfInfo)}`
      : undefined,
    artifact.contentFacts ? `contentFactsAt: ${new Date(artifact.contentFacts.extractedAt).toISOString()}` : undefined,
    enrichmentEvents.length ? `enrichmentEventCount: ${enrichmentEvents.length}` : undefined,
    lastEnrichmentEvent ? `lastEnrichmentKind: ${lastEnrichmentEvent.kind}` : undefined,
    lastEnrichmentEvent ? `lastEnrichmentStatus: ${lastEnrichmentEvent.status}` : undefined,
    lastEnrichmentEvent ? `lastEnrichmentFormat: ${lastEnrichmentEvent.format}` : undefined,
    lastEnrichmentEvent?.reason ? `lastEnrichmentReason: ${lastEnrichmentEvent.reason}` : undefined,
    lastEnrichmentEvent?.resultSummary
      ? `lastEnrichmentSummary: ${formatInlineText(lastEnrichmentEvent.resultSummary)}`
      : undefined,
    lastEnrichmentEvent?.error ? `lastEnrichmentError: ${formatInlineText(lastEnrichmentEvent.error)}` : undefined,
    lastEnrichmentEvent ? `lastEnrichmentAt: ${new Date(lastEnrichmentEvent.attemptedAt).toISOString()}` : undefined,
    `previewCardFormat: ${previewCard.formatLabel}`,
    `previewCardThumbnail: ${previewCard.thumbnailLabel}`,
    `previewCardSummary: ${previewCard.summary}`,
    previewCard.location ? `previewCardLocation: ${previewCard.location}` : undefined,
    `previewCardAction: ${previewCard.primaryAction}`,
    previewCard.safetyNote ? `previewCardSafety: ${previewCard.safetyNote}` : undefined,
    `valueHealthStatus: ${valueHealth.status}`,
    `valueHealthSummary: ${valueHealth.summary}`,
    valueHealth.strengths.length ? `valueHealthStrengths: ${valueHealth.strengths.join(', ')}` : undefined,
    valueHealth.gaps.length ? `valueHealthGaps: ${valueHealth.gaps.join(', ')}` : undefined,
    valueHealth.nextActions.length ? `valueHealthNextActions: ${valueHealth.nextActions.join(', ')}` : undefined,
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

  if (params.artifact.reuseKind) {
    const assetIndexPath = getRepositoryAssetIndexPath(params.binding);
    const existingAssetIndex = await repository.readText(params.binding.repoPath, assetIndexPath);
    const nextAssetIndex = upsertOutputIndexEntry(
      ensureIndexTitle(existingAssetIndex, '# Reusable Assets'),
      outputPath,
      buildReusableAssetIndexEntry(params.artifact, outputPath, previewPath),
    );
    await repository.writeText(params.binding.repoPath, assetIndexPath, nextAssetIndex);
  }

  return { outputId: params.artifact.id, outputPath, previewPath };
}

export function buildArtifactRepositoryOutputUpdates(output: RepositoryOutputResult): ArtifactRepositoryOutputUpdates {
  return {
    repositoryOutputPath: output.outputPath,
    repositoryPreviewPath: output.previewPath,
  };
}

export async function recordRepositoryAssetIndexEntry(
  params: RecordRepositoryAssetIndexEntryParams,
): Promise<RepositoryAssetIndexEntryResult> {
  const repository = getRepositoryWriteApi();
  const assetIndexPath = getRepositoryAssetIndexPath(params.binding);
  const assetPath = normalizeRepositoryAssetPath(params.path, assetIndexPath);
  const assetId = slugRepositoryAssetId(params.id ?? assetPath);
  const existingAssetIndex = await repository.readText(params.binding.repoPath, assetIndexPath);
  const indexEntry = buildRepositoryAssetIndexEntry({ ...params, id: assetId, path: assetPath }, assetIndexPath);
  const nextAssetIndex = upsertOutputIndexEntry(
    ensureIndexTitle(existingAssetIndex, '# Reusable Assets'),
    assetPath,
    indexEntry,
  );

  await repository.writeText(params.binding.repoPath, assetIndexPath, nextAssetIndex);

  return {
    indexPath: assetIndexPath,
    assetId,
    assetPath,
    recordOnly: true,
    desktopExecutes: false,
    grantsPermission: false,
  };
}

export async function searchRepositoryAssetIndex(
  params: SearchRepositoryAssetIndexParams,
): Promise<RepositoryAssetSearchResultSet> {
  const repository = getRepositoryReadApi();
  const indexPath = getRepositoryAssetIndexPath(params.binding);
  const existingAssetIndex = await repository.readText(params.binding.repoPath, indexPath);
  const query = params.query?.trim().toLowerCase();
  const limit = normalizeRepositoryAssetSearchLimit(params.limit);
  const matches = parseRepositoryAssetIndex(existingAssetIndex).filter((asset) => {
    if (params.reuseKind && asset.reuseKind !== params.reuseKind) return false;
    if (query && !buildRepositoryAssetSearchText(asset).includes(query)) return false;
    return true;
  });

  return {
    indexPath,
    total: matches.length,
    results: matches.slice(0, limit),
  };
}

export async function recordRepositoryAssetExecution(
  params: RecordRepositoryAssetExecutionParams,
): Promise<RepositoryAssetExecutionRecordResult> {
  const repository = getRepositoryWriteApi();
  const indexPath = getRepositoryAssetIndexPath(params.binding);
  const existingAssetIndex = await repository.readText(params.binding.repoPath, indexPath);
  const assetPath = params.path ? normalizeRepositoryAssetPath(params.path, indexPath) : undefined;
  const asset = findRepositoryAssetExecutionTarget(parseRepositoryAssetIndex(existingAssetIndex), {
    assetId: params.assetId,
    assetPath,
  });
  if (!asset) throw new Error('repository asset not found');
  if (!EXECUTABLE_REPOSITORY_ASSET_REUSE_KINDS.has(asset.reuseKind)) {
    throw new Error('repository asset is not executable');
  }

  const executedAt = normalizeRepositoryAssetExecutionDate(params.executedAt);
  const runPath = buildRepositoryAssetExecutionRunPath(params.binding, asset.id, executedAt);
  const runIndexPath = getRepositoryAssetRunIndexPath(params.binding);
  const reviewSuggested = TERMINAL_ASSET_EXECUTION_STATUSES.has(params.status);
  const assetExecutionPath = asset.path ?? asset.output ?? asset.link;
  const existingRunIndex = await readRepositoryTextOrEmpty(repository, params.binding.repoPath, runIndexPath);

  await repository.writeText(
    params.binding.repoPath,
    runPath,
    buildRepositoryAssetExecutionMarkdown({ asset, params, runPath, executedAt, reviewSuggested }),
  );
  await repository.writeText(
    params.binding.repoPath,
    runIndexPath,
    upsertRepositoryAssetExecutionIndexEntry(
      existingRunIndex,
      runPath,
      buildRepositoryAssetExecutionIndexEntry({
        asset,
        params,
        runPath,
        runIndexPath,
        executedAt,
        reviewSuggested,
      }),
    ),
  );
  await repository.writeText(
    params.binding.repoPath,
    indexPath,
    updateRepositoryAssetIndexExecution(existingAssetIndex, asset, {
      runPath,
      status: params.status,
      resultSummary: params.resultSummary,
      reviewSuggested,
    }),
  );

  return {
    indexPath,
    runPath,
    runIndexPath,
    assetId: asset.id,
    assetPath: assetExecutionPath,
    title: asset.title,
    reuseKind: asset.reuseKind,
    status: params.status,
    reviewSuggested,
    reviewTarget: reviewSuggested ? 'reviews/weekly/' : undefined,
    recordOnly: true,
    desktopExecutes: false,
    grantsPermission: false,
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
  const valueHealth = buildArtifactValueHealth(artifact);
  const executionCount = artifact.executionEvents?.length ?? 0;
  const lastExecutionEvent = artifact.executionEvents?.[executionCount - 1];
  const enrichmentCount = artifact.enrichmentEvents?.length ?? 0;
  const lastEnrichmentEvent = artifact.enrichmentEvents?.[enrichmentCount - 1];
  return [
    `- [${artifact.title}](${outputPath}) (\`${artifact.id}\`, ${artifact.type}, ${artifact.status})`,
    `  - artifact: artifact://${artifact.id}`,
    `  - source: ${formatArtifactSource(artifact)}`,
    `  - createdAt: ${new Date(artifact.createdAt).toISOString()}`,
    `  - updatedAt: ${new Date(artifact.updatedAt).toISOString()}`,
    previewPath ? `  - preview: ${previewPath}` : undefined,
    artifact.externalFormat ? `  - format: ${artifact.externalFormat}` : undefined,
    artifact.contentSummary ? `  - summary: ${artifact.contentSummary}` : undefined,
    artifact.thumbnail ? '  - thumbnail: available' : undefined,
    artifact.contentExtract
      ? `  - contentExtract: ${artifact.contentExtract.status}, ${artifact.contentExtract.textLength} chars${
          artifact.contentExtract.truncated ? ', truncated' : ''
        }`
      : undefined,
    artifact.contentFacts
      ? `  - contentFacts: ${artifact.contentFacts.status}, sha256 ${artifact.contentFacts.sha256.slice(0, 12)}`
      : undefined,
    artifact.contentFacts?.pdfInfo
      ? `  - contentFactsPdf: ${formatArtifactPdfFacts(artifact.contentFacts.pdfInfo)}`
      : undefined,
    lastEnrichmentEvent ? `  - enrichment: ${lastEnrichmentEvent.kind}, ${lastEnrichmentEvent.status}` : undefined,
    `  - valueHealth: ${valueHealth.status}`,
    valueHealth.gaps.length ? `  - valueHealthGaps: ${valueHealth.gaps.join(', ')}` : undefined,
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

function buildReusableAssetIndexEntry(artifact: ArtifactMeta, outputPath: string, previewPath?: string): string {
  const valueHealth = buildArtifactValueHealth(artifact);
  const executionCount = artifact.executionEvents?.length ?? 0;
  const lastExecutionEvent = artifact.executionEvents?.[executionCount - 1];
  const reviewSummary = buildArtifactExecutionReviewSummary(artifact);
  return [
    `- [${artifact.title}](${outputPath}) (\`${artifact.id}\`, ${artifact.reuseKind}, ${artifact.type}, ${artifact.status})`,
    `  - artifact: artifact://${artifact.id}`,
    `  - output: ${outputPath}`,
    previewPath ? `  - preview: ${previewPath}` : undefined,
    `  - source: ${formatArtifactSource(artifact)}`,
    `  - version: ${artifact.currentVersion}`,
    `  - updatedAt: ${new Date(artifact.updatedAt).toISOString()}`,
    artifact.contentSummary ? `  - summary: ${artifact.contentSummary}` : undefined,
    `  - valueHealth: ${valueHealth.status}`,
    lastExecutionEvent ? `  - execution: ${executionCount} events, last ${lastExecutionEvent.status}` : undefined,
    reviewSummary ? `  - review: pending, write ${reviewSummary.suggestedReviewTarget} entry` : undefined,
    reviewSummary?.latestResultSummary
      ? `  - reviewResult: ${formatInlineText(reviewSummary.latestResultSummary)}`
      : undefined,
    '  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false',
    artifact.tags.length > 0 ? `  - tags: ${artifact.tags.join(', ')}` : undefined,
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

function buildRepositoryAssetIndexEntry(
  params: Omit<RecordRepositoryAssetIndexEntryParams, 'binding'> & { id: string },
  assetIndexPath: string,
): string {
  const source = params.source?.trim() || 'repository-manual';
  const tags = params.tags?.map((tag) => tag.trim()).filter((tag) => tag.length > 0) ?? [];
  const updatedAt = formatRepositoryAssetDate(params.updatedAt);
  return [
    `- [${params.title}](${buildRepositoryAssetIndexLink(params.path, assetIndexPath)}) (\`${params.id}\`, ${params.reuseKind}, ${source})`,
    `  - source: ${source}`,
    `  - path: ${params.path}`,
    params.version ? `  - version: ${params.version}` : undefined,
    updatedAt ? `  - updatedAt: ${updatedAt}` : undefined,
    params.summary ? `  - summary: ${formatInlineText(params.summary)}` : undefined,
    '  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false',
    tags.length > 0 ? `  - tags: ${tags.join(', ')}` : undefined,
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

function parseRepositoryAssetIndex(indexMarkdown: string): RepositoryAssetSearchResult[] {
  const lines = indexMarkdown.split(/\r?\n/);
  const assets: RepositoryAssetSearchResult[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const entryMatch = /^- \[([^\]]+)]\(([^)]+)\) \(`([^`]+)`,\s*(.+)\)$/.exec(lines[index]);
    if (!entryMatch) continue;

    const [, title, link, id, rest] = entryMatch;
    const metadata = new Map<string, string>();
    let next = index + 1;
    while (next < lines.length && lines[next].startsWith('  - ')) {
      const line = lines[next].slice('  - '.length);
      const separator = line.indexOf(':');
      if (separator > -1) {
        metadata.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
      }
      next += 1;
    }
    index = next - 1;

    const parts = rest
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const reuseKind = parseRepositoryAssetReuseKind(metadata.get('reuseKind') ?? parts[0]);
    if (!reuseKind) continue;

    assets.push({
      id,
      title,
      link,
      reuseKind,
      ...definedRepositoryAssetMetadata({
        source: metadata.get('source') ?? parts[1],
        path: metadata.get('path'),
        artifactUri: metadata.get('artifact'),
        output: metadata.get('output'),
        preview: metadata.get('preview'),
        version: metadata.get('version'),
        updatedAt: metadata.get('updatedAt'),
        summary: metadata.get('summary'),
        valueHealth: metadata.get('valueHealth'),
        execution: metadata.get('execution'),
        lastRun: metadata.get('lastRun'),
        review: metadata.get('review'),
        reviewResult: metadata.get('reviewResult'),
      }),
      tags: parseRepositoryAssetTags(metadata.get('tags')),
      boundary: {
        recordOnly: true,
        desktopExecutes: false,
        grantsPermission: false,
      },
    });
  }

  return assets;
}

function findRepositoryAssetExecutionTarget(
  assets: RepositoryAssetSearchResult[],
  params: { assetId?: string; assetPath?: string },
): RepositoryAssetSearchResult | undefined {
  if (params.assetId) return assets.find((asset) => asset.id === params.assetId);
  if (params.assetPath) {
    return assets.find(
      (asset) =>
        asset.path === params.assetPath || asset.output === params.assetPath || asset.link === params.assetPath,
    );
  }
  return undefined;
}

function buildRepositoryAssetExecutionMarkdown(params: {
  asset: RepositoryAssetSearchResult;
  params: RecordRepositoryAssetExecutionParams;
  runPath: string;
  executedAt: Date;
  reviewSuggested: boolean;
}): string {
  const assetPath = params.asset.path ?? params.asset.output ?? params.asset.link;
  const lines = [
    '---',
    `title: ${JSON.stringify(`仓库资产执行 - ${params.asset.title}`)}`,
    'source: desktop-repository-asset-execution',
    `assetId: ${params.asset.id}`,
    `assetPath: ${assetPath}`,
    `assetReuseKind: ${params.asset.reuseKind}`,
    `status: ${params.params.status}`,
    params.params.runner ? `runner: ${formatInlineText(params.params.runner)}` : undefined,
    params.params.command ? `command: ${formatInlineText(params.params.command)}` : undefined,
    params.params.outputArtifactId ? `outputArtifactId: ${params.params.outputArtifactId}` : undefined,
    params.params.repositoryOutputPath ? `repositoryOutputPath: ${params.params.repositoryOutputPath}` : undefined,
    params.params.workItemPath ? `workItemPath: ${params.params.workItemPath}` : undefined,
    `runPath: ${params.runPath}`,
    `executedAt: ${params.executedAt.toISOString()}`,
    'recordOnly: true',
    'desktopExecutes: false',
    'grantsPermission: false',
    '---',
    '',
    `# 仓库资产执行：${params.asset.title}`,
    '',
    '## 摘要',
    '',
    `- 资产：${params.asset.id}`,
    `- 路径：${assetPath}`,
    `- 类型：${params.asset.reuseKind}`,
    `- 状态：${params.params.status}`,
    params.params.runner ? `- 运行器：${params.params.runner}` : undefined,
    params.params.command ? `- 命令：\`${params.params.command}\`` : undefined,
    params.params.resultSummary ? `- 执行结果：${params.params.resultSummary}` : undefined,
    params.params.outputArtifactId ? `- 输出产物：artifact://${params.params.outputArtifactId}` : undefined,
    params.params.repositoryOutputPath ? `- 仓库输出：${params.params.repositoryOutputPath}` : undefined,
    params.params.workItemPath ? `- 关联事项：${params.params.workItemPath}` : undefined,
    '',
    '## 复盘线索',
    '',
    params.reviewSuggested ? '- [ ] 写入 `reviews/weekly/` 复盘。' : '- 当前状态尚未进入终态复盘。',
    params.reviewSuggested ? '- [ ] 关联输出、复用判断和后续动作。' : undefined,
    '',
    '## 边界',
    '',
    '- Desktop 只记录仓库资产执行事实，不执行资产。',
    '- Desktop 不授予执行权限，不替代用户审批。',
    '',
  ];

  return lines.filter((line): line is string => typeof line === 'string').join('\n');
}

function updateRepositoryAssetIndexExecution(
  existingIndex: string,
  asset: RepositoryAssetSearchResult,
  execution: {
    runPath: string;
    status: ArtifactExecutionStatus;
    resultSummary?: string;
    reviewSuggested: boolean;
  },
): string {
  const lines = existingIndex.trimEnd().split('\n');
  let start = -1;
  let end = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const entryMatch = /^- \[[^\]]+]\([^)]+\) \(`([^`]+)`,/.exec(lines[index]);
    if (!entryMatch || entryMatch[1] !== asset.id) continue;
    start = index;
    end = index + 1;
    while (end < lines.length && lines[end].startsWith('  - ')) end += 1;
    break;
  }

  if (start === -1 || end === -1) throw new Error('repository asset index entry not found');

  const previousMetadataLines = lines.slice(start + 1, end);
  const metadataLines = previousMetadataLines.filter(
    (line) =>
      !line.startsWith('  - execution:') &&
      !line.startsWith('  - lastRun:') &&
      !line.startsWith('  - review:') &&
      !line.startsWith('  - reviewResult:'),
  );
  const previousExecutionLine = previousMetadataLines.find((line) => line.startsWith('  - execution:'));
  const executionCount = parseRepositoryAssetExecutionCount(previousExecutionLine) + 1;
  const executionLines = [
    `  - execution: ${executionCount} events, last ${execution.status}`,
    `  - lastRun: ${execution.runPath}`,
    execution.reviewSuggested ? '  - review: pending, write reviews/weekly/ entry' : undefined,
    execution.reviewSuggested && execution.resultSummary
      ? `  - reviewResult: ${formatInlineText(execution.resultSummary)}`
      : undefined,
  ].filter((line): line is string => typeof line === 'string');
  const boundaryIndex = metadataLines.findIndex((line) => line.startsWith('  - boundary:'));
  const nextMetadataLines =
    boundaryIndex === -1
      ? [...metadataLines, ...executionLines]
      : [...metadataLines.slice(0, boundaryIndex), ...executionLines, ...metadataLines.slice(boundaryIndex)];

  return [...lines.slice(0, start + 1), ...nextMetadataLines, ...lines.slice(end)].join('\n').trimEnd() + '\n';
}

function buildRepositoryAssetExecutionIndexEntry(params: {
  asset: RepositoryAssetSearchResult;
  params: RecordRepositoryAssetExecutionParams;
  runPath: string;
  runIndexPath: string;
  executedAt: Date;
  reviewSuggested: boolean;
}): string {
  const assetPath = params.asset.path ?? params.asset.output ?? params.asset.link;
  const lines = [
    `- [${params.asset.title}](${buildRepositoryAssetIndexLink(params.runPath, params.runIndexPath)}) (` +
      `\`${params.asset.id}\`, ${params.asset.reuseKind}, ${params.params.status})`,
    `  - assetPath: ${assetPath}`,
    `  - runPath: ${params.runPath}`,
    `  - executedAt: ${params.executedAt.toISOString()}`,
    params.params.runner ? `  - runner: ${formatInlineText(params.params.runner)}` : undefined,
    params.params.command ? `  - command: ${formatInlineText(params.params.command)}` : undefined,
    params.params.resultSummary ? `  - result: ${formatInlineText(params.params.resultSummary)}` : undefined,
    params.params.outputArtifactId ? `  - outputArtifact: artifact://${params.params.outputArtifactId}` : undefined,
    params.params.repositoryOutputPath ? `  - output: ${params.params.repositoryOutputPath}` : undefined,
    params.params.workItemPath ? `  - workItem: ${params.params.workItemPath}` : undefined,
    params.reviewSuggested ? '  - review: pending, write reviews/weekly/ entry' : undefined,
    '  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false',
  ];
  return lines.filter((line): line is string => typeof line === 'string').join('\n');
}

function upsertRepositoryAssetExecutionIndexEntry(existingIndex: string, runPath: string, indexEntry: string): string {
  const base = ensureIndexTitle(existingIndex, '# Asset Runs').trimEnd();
  if (!base.includes(runPath)) return `${base}\n${indexEntry}\n`;

  const lines = base.split('\n');
  const start = lines.findIndex((line) => line.includes(runPath));
  if (start === -1) return `${base}\n${indexEntry}\n`;

  let entryStart = start;
  while (entryStart > 0 && lines[entryStart].startsWith('  - ')) entryStart -= 1;
  let entryEnd = entryStart + 1;
  while (entryEnd < lines.length && lines[entryEnd].startsWith('  - ')) entryEnd += 1;

  return (
    [...lines.slice(0, entryStart), ...indexEntry.split('\n'), ...lines.slice(entryEnd)].join('\n').trimEnd() + '\n'
  );
}

function parseRepositoryAssetExecutionCount(value: string | undefined): number {
  if (!value) return 0;
  const match = /execution:\s*(\d+)\s+events/.exec(value);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureIndexTitle(existingIndex: string, title: string): string {
  const trimmed = existingIndex.trimEnd();
  if (!trimmed) return `${title}\n`;
  return trimmed.startsWith(title) ? `${trimmed}\n` : `${title}\n${trimmed}\n`;
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

function getRepositoryAssetIndexPath(binding: RepositoryBinding): string {
  return binding.paths.outputs ? `${binding.paths.outputs}/assets/index.md` : DEFAULT_REPOSITORY_ASSET_INDEX_PATH;
}

function getRepositoryAssetRunIndexPath(binding: RepositoryBinding): string {
  return `${binding.paths.runs || 'runs'}/assets/index.md`;
}

async function readRepositoryTextOrEmpty(
  repository: { readText: (repoPath: string, relativePath: string) => Promise<string> },
  repoPath: string,
  relativePath: string,
): Promise<string> {
  try {
    return await repository.readText(repoPath, relativePath);
  } catch {
    return '';
  }
}

function normalizeRepositoryAssetPath(value: string, assetIndexPath: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
  const isWindowsAbsolutePath = /^[a-zA-Z]:\//.test(normalized);
  const parts = normalized.split('/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    isWindowsAbsolutePath ||
    normalized === assetIndexPath ||
    parts.some((part) => !part || part === '.' || part === '..' || part === '.git')
  ) {
    throw new Error('invalid repository asset path');
  }
  return normalized;
}

function buildRepositoryAssetIndexLink(assetPath: string, assetIndexPath: string): string {
  const fromParts = assetIndexPath.split('/').slice(0, -1);
  const toParts = assetPath.split('/');
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common += 1;
  const upParts = fromParts.slice(common).map(() => '..');
  return [...upParts, ...toParts.slice(common)].join('/') || '.';
}

function slugRepositoryAssetId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'repository-asset'
  );
}

function normalizeRepositoryAssetExecutionDate(value: Date | string | number | undefined): Date {
  if (value === undefined) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid repository asset execution date');
  return date;
}

function buildRepositoryAssetExecutionRunPath(binding: RepositoryBinding, assetId: string, executedAt: Date): string {
  const runsRoot = binding.paths.runs || 'runs';
  const stamp = executedAt.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  return `${runsRoot}/assets/${stamp}-${slugRepositoryAssetId(assetId)}.md`;
}

function formatRepositoryAssetDate(value: Date | string | number | undefined): string | undefined {
  if (value === undefined) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function parseRepositoryAssetReuseKind(value: string | undefined): ArtifactReuseKind | undefined {
  return value && REPOSITORY_ASSET_REUSE_KINDS.has(value as ArtifactReuseKind)
    ? (value as ArtifactReuseKind)
    : undefined;
}

function parseRepositoryAssetTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function definedRepositoryAssetMetadata<T extends Record<string, string | undefined>>(metadata: T) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as {
    [K in keyof T as T[K] extends string ? K : never]: string;
  };
}

function normalizeRepositoryAssetSearchLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(Math.trunc(value), 50));
}

function buildRepositoryAssetSearchText(asset: RepositoryAssetSearchResult): string {
  return [
    asset.id,
    asset.title,
    asset.link,
    asset.reuseKind,
    ...getRepositoryAssetReuseKindAliases(asset.reuseKind),
    asset.source,
    asset.path,
    asset.artifactUri,
    asset.output,
    asset.preview,
    asset.version,
    asset.updatedAt,
    asset.summary,
    asset.valueHealth,
    asset.execution,
    asset.lastRun,
    asset.review,
    asset.reviewResult,
    ...asset.tags,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .toLowerCase();
}

function getRepositoryAssetReuseKindAliases(reuseKind: ArtifactReuseKind): string[] {
  const aliases: Record<ArtifactReuseKind, string[]> = {
    asset: ['可复用资产', '通用资产'],
    template: ['模板', '可复用模板', '可复用的模板'],
    tool: ['工具', '可复用工具', '可复用的工具'],
    script: ['脚本', '可复用脚本', '可复用的脚本'],
    workflow: ['工作流', '流程', '可复用工作流', '可复用的工作流'],
  };
  return aliases[reuseKind];
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

function getRepositoryReadApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.readText) {
    throw new Error('electronAPI.repository read methods not available');
  }
  return {
    readText: repository.readText,
  };
}
