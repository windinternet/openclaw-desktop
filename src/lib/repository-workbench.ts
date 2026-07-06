import type { RepositoryBinding, SemanticSlot } from './agentic-repository';
import type { ArtifactMeta } from './artifact-types';
import {
  extractSafeRepositoryAssetRunPathFromText,
  isRepositoryAssetRunPathLike,
  isSafeRepositoryAssetRunPath,
} from './dashboard-tail-action-routing';
import type { RepositoryMarkdownFile } from './repository-knowledge';
import type { AiActionRepositoryWrite, AiActionRun } from './types';
import {
  isSafeWorkbenchMarkdownPath,
  isSafeWorkbenchMatterLikePath,
  isSafeWorkbenchTailActionWorkItemPath,
} from './workbench-matter';

const WORKBENCH_MATTER_STATUSES = new Set(['active', 'blocked', 'done', 'paused']);
const TERMINAL_REPOSITORY_ASSET_RUN_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export interface WorkbenchSemanticSection {
  key: string;
  title: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  paths: string[];
  files: RepositoryMarkdownFile[];
  documents: WorkbenchSemanticDocument[];
  markdown: string;
}

export interface WorkbenchSemanticDocument {
  path: string;
  title: string;
  content: string;
  file: RepositoryMarkdownFile;
}

export interface WorkbenchReviewDocument {
  path: string;
  title: string;
  content: string;
  file: RepositoryMarkdownFile;
}

export interface WorkbenchProject {
  id: string;
  name: string;
  path: string;
  status: string;
  summary: string;
  updatedAt: number;
}

export interface WorkbenchTaskItem {
  id: string;
  text: string;
  sourcePath: string;
  completed: boolean;
}

export interface WorkbenchTaskGroup {
  id: 'current' | 'next' | 'done';
  title: string;
  path: string;
  items: WorkbenchTaskItem[];
}

export interface WorkbenchTailAction {
  id: string;
  text: string;
  sourcePath: string;
  completed: boolean;
  updatedAt: number;
}

export interface WorkbenchReviewDraftInput {
  workItemPath: string;
  tailActionId?: string;
  relatedKnowledgeRunIds?: string[];
  relatedKnowledgeRuns?: WorkbenchReviewDraftKnowledgeRun[];
  createdAt?: Date;
}

export interface WorkbenchAssetRunReviewDraftInput {
  assetRunPath: string;
  workItemPath?: string;
  reviewSummary?: string;
  reuseDecision?: string;
  nextActions?: string[];
  reviewer?: string;
  createdAt?: Date;
}

export interface WorkbenchReviewDraftKnowledgeRun {
  id: string;
  status: string;
  resultSummary?: string;
  error?: string;
}

export interface WorkbenchReviewDraftResult {
  path: string;
  content: string;
}

export interface WorkbenchReviewConfirmInput {
  reviewPath: string;
  workItemPath: string;
  tailActionId: string;
  reviewedAt?: Date;
}

export interface WorkbenchAssetRunReviewConfirmInput {
  reviewPath: string;
  assetRunPath: string;
  reviewedAt?: Date;
}

export interface WorkbenchMatterStatusUpdateInput {
  workItemPath: string;
  tailActionId: string;
  status: string;
}

export interface WorkbenchMatterArchiveInput {
  workItemPath: string;
}

export interface WorkbenchMatterArchiveResult {
  archived: boolean;
  archivedPath?: string;
}

export interface WorkbenchKnowledgeTailActionConfirmInput {
  workItemPath: string;
  tailActionId: string;
}

export interface WorkbenchOutputPreservationInput {
  workItemPath: string;
  tailActionId?: string;
  artifact: Pick<ArtifactMeta, 'id' | 'title' | 'type' | 'repositoryOutputPath' | 'repositoryPreviewPath'>;
}

export interface WorkbenchMatterPlanApprovalInput {
  actionRunId: string;
  workItemPath?: string;
  repositoryWrite: AiActionRepositoryWrite;
  approvedAt?: Date;
}

export interface WorkbenchMatterPlanApprovalResult {
  planPath: string;
  workItemPath: string;
}

export interface WorkbenchSnapshot {
  inboxMarkdown: string;
  activeWork: RepositoryMarkdownFile[];
  completedWork: RepositoryMarkdownFile[];
  somedayWork: RepositoryMarkdownFile[];
  activePlans: RepositoryMarkdownFile[];
  completedPlans: RepositoryMarkdownFile[];
  runsMarkdown: string;
  outputsMarkdown: string;
  reviews: RepositoryMarkdownFile[];
  reviewDocuments?: WorkbenchReviewDocument[];
  planMetadata: RepositoryPlanMetadata[];
  workMetadata?: RepositoryWorkMetadata[];
  reviewGroups: RepositoryReviewGroup[];
  semanticSections: WorkbenchSemanticSection[];
  projects: WorkbenchProject[];
  taskGroups: WorkbenchTaskGroup[];
  tailActions: WorkbenchTailAction[];
}

export function isWorkbenchSnapshotMatterPath(
  snapshot: Pick<WorkbenchSnapshot, 'activeWork' | 'completedWork' | 'somedayWork'> | null | undefined,
  path: string | null | undefined,
): boolean {
  const value = path?.trim();
  if (!snapshot || !value || value !== path || value.startsWith('/') || value.includes('\\')) return false;
  if (value.split('/').includes('..')) return false;
  return [...snapshot.activeWork, ...snapshot.completedWork, ...snapshot.somedayWork].some(
    (item) => item.path === value,
  );
}

export interface RepositoryPlanMetadata {
  path: string;
  status?: string;
  approval?: string;
  blockedReason?: string;
  blockerOwner?: string;
  workItemPath?: string;
  dependencies?: string[];
  dependencySources?: Record<string, string>;
}

export interface RepositoryWorkMetadata {
  path: string;
  owner?: string;
  dependencies?: string[];
  dependencySources?: Record<string, string>;
}

export interface RepositoryReviewGroup {
  group: string;
  files: RepositoryMarkdownFile[];
}

export interface RepositoryAssetPermissionBoundary {
  recordOnly: boolean | null;
  desktopExecutes: boolean | null;
  grantsPermission: boolean | null;
  requiresApproval: boolean;
}

export interface RepositoryAssetRunDetails {
  assetRunPath: string;
  title: string;
  assetId?: string;
  assetPath?: string;
  assetReuseKind?: string;
  status?: string;
  approvalTitle?: string;
  approvalRisk?: string;
  approvalReason?: string;
  sourceApprovalRunPath?: string;
  runner?: string;
  command?: string;
  repositoryOutputPath?: string;
  outputArtifactId?: string;
  workItemPath?: string;
  executedAt?: string;
  resultSummary?: string;
}

export interface RepositoryAssetRunOutputState {
  status: 'preserved' | 'pending';
  outputPath?: string;
  artifactId?: string;
}

export type RepositoryAssetRunApprovalState = 'pending' | 'approved' | 'denied';

export interface RepositoryAssetRunApprovalDecisionState {
  status: 'approved' | 'denied';
  runPath: string;
  decidedAt?: string;
}

export type RepositoryAssetRunExecutionStatus = 'succeeded' | 'failed' | 'cancelled';

export interface RepositoryAssetRunExecutionState {
  status: RepositoryAssetRunExecutionStatus;
  runPath: string;
  executedAt?: string;
  resultSummary?: string;
  outputState?: RepositoryAssetRunOutputState['status'];
}

export interface RepositoryAssetRunListFollowUpState {
  approvalDecisionState?: RepositoryAssetRunApprovalDecisionState;
  executionState?: RepositoryAssetRunExecutionState;
  knowledgeUpdateState?: RepositoryAssetRunKnowledgeUpdateState;
  reviewState?: RepositoryAssetRunReviewState;
}

export interface RepositoryAssetRunReviewState {
  status: 'draft' | 'confirmed';
  reviewPath: string;
}

export type RepositoryAssetRunEffectiveReviewState = 'pending' | RepositoryAssetRunReviewState['status'];

export type RepositoryAssetRunFollowUpKind = 'status' | 'output' | 'knowledge' | 'review' | 'general';

export interface RepositoryAssetRunFollowUpState {
  kind: RepositoryAssetRunFollowUpKind;
  text: string;
  sourcePath: string;
  completed: boolean;
}

export interface RepositoryAssetExecutionApprovalCommand {
  command: 'desktop.repository.assets.execution.record';
  params: {
    repoPath: string;
    assetId?: string;
    path?: string;
    status: 'approval_required';
    approvalTitle?: string;
    approvalRisk?: string;
    approvalReason?: string;
    runner: string;
    command: string;
    workItemPath?: string;
  };
  text: string;
}

export interface RepositoryAssetPendingApprovalState {
  status: 'pending';
  runPath: string;
  title: string;
  requestedAt?: string;
  approvalTitle?: string;
  approvalRisk?: string;
  approvalReason?: string;
  decisionCommands?: RepositoryAssetRunApprovalDecisionCommands;
}

export interface RepositoryAssetResolvedRunState {
  status: 'approved' | 'denied' | RepositoryAssetRunExecutionStatus;
  runPath: string;
  recordedAt?: string;
  resultSummary?: string;
  outputState?: RepositoryAssetRunOutputState['status'];
  workItemPath?: string;
  reviewState?: 'pending' | RepositoryAssetRunReviewState['status'];
}

export interface RepositoryAssetResolvedRunFollowUpActions {
  canPreserveOutput: boolean;
  canUpdateKnowledge: boolean;
  canWriteReview: boolean;
}

export interface RepositoryAssetRunKnowledgeUpdateState {
  status: 'running' | 'awaiting_approval' | 'done' | 'no_write_needed' | 'failed' | 'cancelled';
  runId: string;
  summary?: string;
  updatedAt: number;
}

export interface RepositoryAssetRunApprovalDecisionCommand {
  command: 'desktop.repository.assets.execution.record';
  params: {
    repoPath: string;
    assetId?: string;
    path?: string;
    status: 'approved' | 'denied';
    approvalTitle?: string;
    approvalRisk?: string;
    approvalReason?: string;
    sourceApprovalRunPath?: string;
    runner?: string;
    command?: string;
    workItemPath?: string;
  };
  text: string;
}

export interface RepositoryAssetRunApprovalDecisionCommands {
  approve: RepositoryAssetRunApprovalDecisionCommand & {
    params: RepositoryAssetRunApprovalDecisionCommand['params'] & { status: 'approved' };
  };
  deny: RepositoryAssetRunApprovalDecisionCommand & {
    params: RepositoryAssetRunApprovalDecisionCommand['params'] & { status: 'denied' };
  };
}

export interface RepositoryAssetRunIndexLink {
  path: string;
  title: string;
  assetId?: string;
  assetPath?: string;
  reuseKind?: string;
  status?: string;
  approvalTitle?: string;
  approvalRisk?: string;
  approvalReason?: string;
  sourceApprovalRunPath?: string;
  approvalState?: RepositoryAssetRunApprovalState;
  approvalPending?: boolean;
  outputState?: RepositoryAssetRunOutputState['status'];
  executedAt?: string;
  resultSummary?: string;
  workItemPath?: string;
  reviewPending: boolean;
}

export async function loadWorkbenchSnapshot(binding: RepositoryBinding): Promise<WorkbenchSnapshot> {
  if (binding.workbench?.isWorkbenchRepository) {
    return loadSemanticWorkbenchSnapshot(binding);
  }

  const repository = getWorkbenchReadApi();
  const [
    inboxMarkdown,
    activeWork,
    completedWork,
    somedayWork,
    activePlans,
    completedPlans,
    runsIndexMarkdown,
    actionRunsIndexMarkdown,
    assetRunsIndexMarkdown,
    outputsMarkdown,
    reviews,
  ] = await Promise.all([
    repository.readText(binding.repoPath, `${binding.paths.work}/inbox.md`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.work}/active`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.work}/completed`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.work}/someday`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.plans}/active`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.plans}/completed`),
    repository.readText(binding.repoPath, `${binding.paths.runs}/index.md`),
    repository.readText(binding.repoPath, `${binding.paths.runs}/action-runs/index.md`),
    repository.readText(binding.repoPath, `${binding.paths.runs}/assets/index.md`),
    repository.readText(binding.repoPath, `${binding.paths.outputs}/index.md`),
    repository.listMarkdown(binding.repoPath, binding.paths.reviews),
  ]);
  const runsMarkdown = [runsIndexMarkdown, actionRunsIndexMarkdown, assetRunsIndexMarkdown]
    .filter((part) => part.trim())
    .join('\n\n');

  const [planMetadata, workMetadata, tailActions, reviewDocuments] = await Promise.all([
    Promise.all(
      [...activePlans, ...completedPlans].map(async (file) =>
        parsePlanMetadata(file.path, await repository.readText(binding.repoPath, file.path)),
      ),
    ),
    loadWorkbenchWorkMetadata(binding, [...activeWork, ...completedWork, ...somedayWork]),
    loadWorkbenchTailActions(binding, [...activeWork, ...completedWork, ...somedayWork]),
    loadWorkbenchReviewDocuments(binding, reviews),
  ]);

  return {
    inboxMarkdown,
    activeWork,
    completedWork,
    somedayWork,
    activePlans,
    completedPlans,
    runsMarkdown,
    outputsMarkdown,
    reviews,
    reviewDocuments,
    planMetadata: planMetadata.filter(
      (item) => item.status || item.approval || item.blockerOwner || item.workItemPath || item.dependencies?.length,
    ),
    workMetadata,
    reviewGroups: groupReviewsByFolder(reviews),
    semanticSections: [],
    projects: [],
    taskGroups: [],
    tailActions,
  };
}

async function loadWorkbenchWorkMetadata(
  binding: RepositoryBinding,
  files: RepositoryMarkdownFile[],
): Promise<RepositoryWorkMetadata[]> {
  const repository = getWorkbenchReadApi();
  const metadata = await Promise.all(
    files.map(async (file) => parseWorkMetadata(file.path, await repository.readText(binding.repoPath, file.path))),
  );
  return metadata.filter(hasWorkbenchWorkMetadataFacts);
}

function parseSemanticWorkMetadata(documents: WorkbenchSemanticDocument[]): RepositoryWorkMetadata[] {
  return documents
    .map((document) => parseWorkMetadata(document.path, document.content))
    .filter(hasWorkbenchWorkMetadataFacts);
}

function mergeWorkbenchWorkMetadata(
  primary: RepositoryWorkMetadata[],
  secondary: RepositoryWorkMetadata[],
): RepositoryWorkMetadata[] {
  const metadata = new Map<string, RepositoryWorkMetadata>();
  for (const item of [...secondary, ...primary]) metadata.set(item.path, item);
  return [...metadata.values()];
}

function parseWorkMetadata(path: string, markdown: string): RepositoryWorkMetadata {
  const metadata: RepositoryWorkMetadata = { path };
  for (const { key, value, source } of parseWorkbenchMetadataEntries(markdown)) {
    if (['owner', 'blockerowner'].includes(key)) metadata.owner = value;
    if (key === 'dependencies') {
      const dependencies = parseDependencyReferences(value, path);
      metadata.dependencies = appendUniqueDependencies(metadata.dependencies, dependencies);
      metadata.dependencySources = appendDependencySources(metadata.dependencySources, dependencies, source);
    }
  }
  return metadata;
}

function hasWorkbenchWorkMetadataFacts(metadata: RepositoryWorkMetadata): boolean {
  return Boolean(metadata.owner || metadata.dependencies?.length);
}

async function loadSemanticWorkbenchSnapshot(binding: RepositoryBinding): Promise<WorkbenchSnapshot> {
  const semanticSections = await loadSemanticSections(binding);
  const sectionByKey = new Map(semanticSections.map((section) => [section.key, section]));
  const mappedPathFiles = await loadMappedWorkbenchPathFiles(binding);
  const reviewSection = semanticSections.find((section) => section.key === 'reviews');
  const reviews = reviewSection?.files ?? [];
  const reviewDocuments = reviewSection?.documents ?? [];
  const activeWork = mergeRepositoryMarkdownFiles(sectionByKey.get('current')?.files ?? [], mappedPathFiles.activeWork);
  const completedWork = mergeRepositoryMarkdownFiles(
    sectionByKey.get('done')?.files ?? [],
    mappedPathFiles.completedWork,
  );
  const somedayWork = mergeRepositoryMarkdownFiles(sectionByKey.get('next')?.files ?? [], mappedPathFiles.somedayWork);
  const activePlans = mergeRepositoryMarkdownFiles(
    sectionByKey.get('plans.active')?.files ?? [],
    mappedPathFiles.activePlans,
  );
  const completedPlans = mergeRepositoryMarkdownFiles(
    sectionByKey.get('plans.completed')?.files ?? [],
    mappedPathFiles.completedPlans,
  );
  const semanticTailActions = semanticSections.flatMap((section) =>
    section.documents.flatMap((document) =>
      parseWorkbenchTailActions(document.path, document.content, document.file.updatedAt),
    ),
  );
  const semanticWorkMetadata = [
    ...parseSemanticWorkMetadata(sectionByKey.get('current')?.documents ?? []),
    ...parseSemanticWorkMetadata(sectionByKey.get('next')?.documents ?? []),
    ...parseSemanticWorkMetadata(sectionByKey.get('done')?.documents ?? []),
  ];
  const [pathTailActions, planMetadata, pathWorkMetadata] = await Promise.all([
    loadWorkbenchTailActions(binding, [...activeWork, ...completedWork, ...somedayWork]),
    Promise.all(
      [...activePlans, ...completedPlans].map(async (file) =>
        parsePlanMetadata(file.path, await getWorkbenchReadApi().readText(binding.repoPath, file.path)),
      ),
    ),
    loadWorkbenchWorkMetadata(binding, [...activeWork, ...completedWork, ...somedayWork]),
  ]);
  return {
    inboxMarkdown: sectionByKey.get('inbox')?.markdown ?? '',
    activeWork,
    completedWork,
    somedayWork,
    activePlans,
    completedPlans,
    runsMarkdown: sectionByKey.get('runs')?.markdown ?? '',
    outputsMarkdown: sectionByKey.get('outputs')?.markdown ?? '',
    reviews,
    reviewDocuments,
    planMetadata,
    workMetadata: mergeWorkbenchWorkMetadata(semanticWorkMetadata, pathWorkMetadata),
    reviewGroups: groupReviewsByFolder(reviews),
    semanticSections,
    projects: deriveProjects(sectionByKey.get('projects')),
    taskGroups: [
      deriveTaskGroup('current', sectionByKey.get('current')),
      deriveTaskGroup('next', sectionByKey.get('next')),
      deriveTaskGroup('done', sectionByKey.get('done')),
    ].filter((group): group is WorkbenchTaskGroup => Boolean(group)),
    tailActions: mergeWorkbenchTailActions(semanticTailActions, pathTailActions),
  };
}

async function loadMappedWorkbenchPathFiles(binding: RepositoryBinding): Promise<{
  activeWork: RepositoryMarkdownFile[];
  completedWork: RepositoryMarkdownFile[];
  somedayWork: RepositoryMarkdownFile[];
  activePlans: RepositoryMarkdownFile[];
  completedPlans: RepositoryMarkdownFile[];
}> {
  const repository = getWorkbenchReadApi();
  const [activeWork, completedWork, somedayWork, activePlans, completedPlans] = await Promise.all([
    repository.listMarkdown(binding.repoPath, `${binding.paths.work}/active`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.work}/completed`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.work}/someday`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.plans}/active`),
    repository.listMarkdown(binding.repoPath, `${binding.paths.plans}/completed`),
  ]);
  return { activeWork, completedWork, somedayWork, activePlans, completedPlans };
}

function mergeRepositoryMarkdownFiles(
  primary: RepositoryMarkdownFile[],
  secondary: RepositoryMarkdownFile[],
): RepositoryMarkdownFile[] {
  const files = new Map<string, RepositoryMarkdownFile>();
  for (const file of [...primary, ...secondary]) files.set(file.path, file);
  return [...files.values()];
}

function mergeWorkbenchTailActions(
  primary: WorkbenchTailAction[],
  secondary: WorkbenchTailAction[],
): WorkbenchTailAction[] {
  const actions = new Map<string, WorkbenchTailAction>();
  for (const action of [...primary, ...secondary]) actions.set(action.id, action);
  return [...actions.values()];
}

async function loadSemanticSections(binding: RepositoryBinding): Promise<WorkbenchSemanticSection[]> {
  const slots = binding.workbench?.slots;
  if (!slots) return [];
  const entries: Array<[string, SemanticSlot | undefined]> = [
    ['inbox', slots.inbox],
    ['current', slots.current],
    ['next', slots.next],
    ['done', slots.done],
    ['projects', slots.projects],
    ['plans.active', slots.plans?.active],
    ['plans.completed', slots.plans?.completed],
    ['runs', slots.runs],
    ['outputs', slots.outputs],
    ['reviews', slots.reviews],
    ['tools', slots.tools],
    ['logs', slots.logs],
  ];
  const sections = await Promise.all(
    entries.map(async ([key, slot]) => (slot ? loadSemanticSection(binding, key, slot) : null)),
  );
  return sections.filter((section): section is WorkbenchSemanticSection => Boolean(section));
}

async function loadSemanticSection(
  binding: RepositoryBinding,
  key: string,
  slot: SemanticSlot,
): Promise<WorkbenchSemanticSection> {
  const repository = getWorkbenchReadApi();
  const files: RepositoryMarkdownFile[] = [];
  const documents: WorkbenchSemanticDocument[] = [];
  const markdownParts: string[] = [];

  const addDocument = async (path: string, file?: RepositoryMarkdownFile) => {
    const content = await repository.readText(binding.repoPath, path);
    const nextFile = file ?? { path, name: path.split('/').pop() ?? path, size: content.length, updatedAt: 0 };
    files.push(nextFile);
    documents.push({
      path,
      title: extractTitle(content) || nextFile.name,
      content,
      file: nextFile,
    });
    markdownParts.push(content);
  };

  for (const path of slot.paths) {
    if (path.endsWith('.md')) {
      await addDocument(path);
    } else {
      const listedFiles = await repository.listMarkdown(binding.repoPath, path);
      for (const file of listedFiles) {
        await addDocument(file.path, file);
      }
    }
  }

  return {
    key,
    title: slot.label,
    confidence: slot.confidence,
    reason: slot.reason,
    paths: slot.paths,
    files,
    documents,
    markdown: markdownParts.filter(Boolean).join('\n\n---\n\n'),
  };
}

export async function readWorkbenchMarkdown(binding: RepositoryBinding, relativePath: string): Promise<string> {
  return getWorkbenchTextApi().readText(binding.repoPath, relativePath);
}

export function parseRepositoryAssetPermissionBoundary(content: string): RepositoryAssetPermissionBoundary {
  return {
    recordOnly: readBooleanField(content, 'recordOnly'),
    desktopExecutes: readBooleanField(content, 'desktopExecutes'),
    grantsPermission: readBooleanField(content, 'grantsPermission'),
    requiresApproval:
      readBooleanField(content, 'requiresApproval') === true ||
      readBooleanField(content, 'approvalRequired') === true ||
      readBooleanField(content, 'requiresUserApproval') === true,
  };
}

export function buildRepositoryAssetExecutionApprovalCommand(
  repoPath: string,
  previewPath: string,
  content: string,
): RepositoryAssetExecutionApprovalCommand | null {
  const reuseKind =
    readWorkbenchFrontmatterValue(content, 'assetReuseKind') ?? readWorkbenchFrontmatterValue(content, 'reuseKind');
  if (!reuseKind || !isRepositoryExecutableAssetKind(reuseKind)) return null;

  const assetId =
    readWorkbenchFrontmatterValue(content, 'assetId') ?? readWorkbenchFrontmatterValue(content, 'id') ?? undefined;
  const path =
    readWorkbenchFrontmatterValue(content, 'assetPath') ??
    readWorkbenchFrontmatterValue(content, 'path') ??
    (isRepositoryAssetRunPathLike(previewPath) ? undefined : previewPath);
  if (!assetId && !path) return null;

  const workItemPath = readWorkbenchFrontmatterValue(content, 'workItemPath') ?? undefined;
  const params = {
    repoPath,
    ...(assetId ? { assetId } : {}),
    ...(path ? { path } : {}),
    status: 'approval_required' as const,
    ...(readWorkbenchFrontmatterValue(content, 'approvalTitle')
      ? { approvalTitle: readWorkbenchFrontmatterValue(content, 'approvalTitle') as string }
      : {}),
    ...(readWorkbenchFrontmatterValue(content, 'approvalRisk')
      ? { approvalRisk: readWorkbenchFrontmatterValue(content, 'approvalRisk') as string }
      : {}),
    ...(readWorkbenchFrontmatterValue(content, 'approvalReason')
      ? { approvalReason: readWorkbenchFrontmatterValue(content, 'approvalReason') as string }
      : {}),
    runner: readWorkbenchFrontmatterValue(content, 'runner') ?? '<external-runner>',
    command: readWorkbenchFrontmatterValue(content, 'command') ?? '<command>',
    ...(workItemPath ? { workItemPath } : {}),
  };

  return {
    command: 'desktop.repository.assets.execution.record',
    params,
    text: JSON.stringify(
      {
        command: 'desktop.repository.assets.execution.record',
        params,
      },
      null,
      2,
    ),
  };
}

export function findRepositoryAssetPendingApprovalState(
  command: RepositoryAssetExecutionApprovalCommand | null,
  runs: RepositoryAssetRunIndexLink[] = [],
): RepositoryAssetPendingApprovalState | null {
  if (!command) return null;
  const assetId = command.params.assetId;
  const assetPath = command.params.path;
  if (!assetId && !assetPath) return null;

  const pendingRuns = runs
    .filter((run) => {
      if (run.status?.trim().toLowerCase() !== 'approval_required') return false;
      if (getRepositoryAssetRunEffectiveApprovalState(run, runs) !== 'pending') return false;
      if (assetId && run.assetId === assetId) return true;
      return Boolean(assetPath && run.assetPath === assetPath);
    })
    .sort((a, b) => {
      const byTime = (b.executedAt ?? '').localeCompare(a.executedAt ?? '');
      if (byTime !== 0) return byTime;
      return b.path.localeCompare(a.path);
    });

  const latest = pendingRuns[0];
  if (!latest) return null;
  const decisionCommands = buildRepositoryAssetRunApprovalDecisionCommands(command.params.repoPath, {
    assetRunPath: latest.path,
    title: latest.title,
    assetId: latest.assetId ?? assetId,
    assetPath: latest.assetPath ?? assetPath,
    status: 'approval_required',
    approvalTitle: latest.approvalTitle ?? command.params.approvalTitle,
    approvalRisk: latest.approvalRisk ?? command.params.approvalRisk,
    approvalReason: latest.approvalReason ?? command.params.approvalReason,
    runner: command.params.runner,
    command: command.params.command,
    workItemPath: command.params.workItemPath,
  });
  return {
    status: 'pending',
    runPath: latest.path,
    title: latest.title,
    ...(latest.executedAt ? { requestedAt: latest.executedAt } : {}),
    ...(latest.approvalTitle ? { approvalTitle: latest.approvalTitle } : {}),
    ...(latest.approvalRisk ? { approvalRisk: latest.approvalRisk } : {}),
    ...(latest.approvalReason ? { approvalReason: latest.approvalReason } : {}),
    ...(decisionCommands ? { decisionCommands } : {}),
  };
}

export function findRepositoryAssetResolvedRunState(
  command: RepositoryAssetExecutionApprovalCommand | null,
  runs: RepositoryAssetRunIndexLink[] = [],
  reviewDocuments: WorkbenchReviewDocument[] = [],
): RepositoryAssetResolvedRunState | null {
  if (!command) return null;
  const assetId = command.params.assetId;
  const assetPath = command.params.path;
  if (!assetId && !assetPath) return null;

  const resolvedRuns = runs
    .filter((run) => {
      if (assetId ? run.assetId !== assetId : run.assetPath !== assetPath) return false;
      const status = run.status?.trim().toLowerCase();
      return (
        run.approvalState === 'approved' ||
        run.approvalState === 'denied' ||
        Boolean(status && TERMINAL_REPOSITORY_ASSET_RUN_STATUSES.has(status))
      );
    })
    .sort((a, b) => {
      const left = b.executedAt ?? b.path;
      const right = a.executedAt ?? a.path;
      return left.localeCompare(right);
    });

  const latest = resolvedRuns[0];
  if (!latest) return null;
  const status = latest.status?.trim().toLowerCase();
  const resolvedStatus =
    latest.approvalState === 'approved' || latest.approvalState === 'denied'
      ? latest.approvalState
      : status && TERMINAL_REPOSITORY_ASSET_RUN_STATUSES.has(status)
        ? (status as RepositoryAssetRunExecutionStatus)
        : null;
  if (!resolvedStatus) return null;
  const reviewState = findRepositoryAssetRunReviewState(latest.path, reviewDocuments);
  const effectiveReviewState =
    reviewState?.status ?? (isRepositoryAssetRunEffectivelyReviewPending(latest, reviewDocuments) ? 'pending' : null);

  return {
    status: resolvedStatus,
    runPath: latest.path,
    ...(latest.executedAt ? { recordedAt: latest.executedAt } : {}),
    ...(latest.resultSummary ? { resultSummary: latest.resultSummary } : {}),
    ...(latest.outputState ? { outputState: latest.outputState } : {}),
    ...(latest.workItemPath ? { workItemPath: latest.workItemPath } : {}),
    ...(effectiveReviewState ? { reviewState: effectiveReviewState } : {}),
  };
}

export function getRepositoryAssetResolvedRunFollowUpActions(
  state: RepositoryAssetResolvedRunState | null,
  knowledgeUpdateState?: RepositoryAssetRunKnowledgeUpdateState,
): RepositoryAssetResolvedRunFollowUpActions {
  const isTerminalRun = Boolean(state && state.status !== 'approved' && state.status !== 'denied');
  const hasActiveKnowledgeUpdate = Boolean(
    knowledgeUpdateState && knowledgeUpdateState.status !== 'failed' && knowledgeUpdateState.status !== 'cancelled',
  );
  return {
    canPreserveOutput: isTerminalRun && state?.outputState !== 'preserved',
    canUpdateKnowledge: isTerminalRun && !hasActiveKnowledgeUpdate,
    canWriteReview: isTerminalRun && state?.reviewState !== 'confirmed',
  };
}

export function findRepositoryAssetRunKnowledgeUpdateState(
  assetRunPath: string | undefined,
  context: { actionRuns?: AiActionRun[] } = {},
): RepositoryAssetRunKnowledgeUpdateState | undefined {
  if (!assetRunPath || !isSafeRepositoryAssetRunPath(assetRunPath)) return undefined;
  const sourceExecutionId = `asset-run-knowledge:${assetRunPath}`;
  const latest = (context.actionRuns ?? [])
    .filter((run) => run.type === 'knowledge_rewrite' && hasSourceExecutionReference(run.input, sourceExecutionId))
    .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)[0];
  if (!latest) return undefined;
  return {
    status: normalizeRepositoryAssetKnowledgeUpdateStatus(latest),
    runId: latest.id,
    ...(latest.resultSummary ? { summary: latest.resultSummary } : {}),
    updatedAt: latest.updatedAt,
  };
}

export function buildRepositoryAssetRunApprovalDecisionCommands(
  repoPath: string,
  details: RepositoryAssetRunDetails,
): RepositoryAssetRunApprovalDecisionCommands | null {
  if (details.status?.trim().toLowerCase() !== 'approval_required') return null;
  if (!details.assetId && !details.assetPath) return null;

  const buildCommand = <Status extends 'approved' | 'denied'>(
    status: Status,
  ): RepositoryAssetRunApprovalDecisionCommand & {
    params: RepositoryAssetRunApprovalDecisionCommand['params'] & { status: Status };
  } => {
    const params = {
      repoPath,
      ...(details.assetId ? { assetId: details.assetId } : {}),
      ...(details.assetPath ? { path: details.assetPath } : {}),
      status,
      ...(details.approvalTitle ? { approvalTitle: details.approvalTitle } : {}),
      ...(details.approvalRisk ? { approvalRisk: details.approvalRisk } : {}),
      ...(details.approvalReason ? { approvalReason: details.approvalReason } : {}),
      ...(isSafeRepositoryAssetRunPath(details.assetRunPath) ? { sourceApprovalRunPath: details.assetRunPath } : {}),
      ...(details.runner ? { runner: details.runner } : {}),
      ...(details.command ? { command: details.command } : {}),
      ...(details.workItemPath ? { workItemPath: details.workItemPath } : {}),
    };
    return {
      command: 'desktop.repository.assets.execution.record',
      params,
      text: JSON.stringify(
        {
          command: 'desktop.repository.assets.execution.record',
          params,
        },
        null,
        2,
      ),
    };
  };

  return {
    approve: buildCommand('approved'),
    deny: buildCommand('denied'),
  };
}

export function parseRepositoryAssetRunDetails(
  assetRunPath: string,
  content: string,
): RepositoryAssetRunDetails | null {
  if (!isSafeRepositoryAssetRunPath(assetRunPath)) return null;
  try {
    return {
      assetRunPath,
      ...parseWorkbenchAssetRunReviewFacts(assetRunPath, content),
    };
  } catch {
    return null;
  }
}

export function findRepositoryAssetRunReviewState(
  assetRunPath: string,
  documents: WorkbenchReviewDocument[] = [],
): RepositoryAssetRunReviewState | null {
  if (!isSafeRepositoryAssetRunPath(assetRunPath)) return null;

  let draftState: RepositoryAssetRunReviewState | null = null;
  for (const document of documents) {
    if (readWorkbenchFrontmatterValue(document.content, 'source') !== 'desktop-repository-asset-execution-review') {
      continue;
    }
    if (readWorkbenchFrontmatterValue(document.content, 'assetRunPath') !== assetRunPath) continue;

    const status = readWorkbenchFrontmatterValue(document.content, 'status');
    if (status === 'confirmed') {
      return { status: 'confirmed', reviewPath: document.path };
    }
    if (status === 'draft' && !draftState) {
      draftState = { status: 'draft', reviewPath: document.path };
    }
  }

  return draftState;
}

export function isRepositoryAssetRunReviewDraftForRun(content: string, assetRunPath: string): boolean {
  if (!isSafeRepositoryAssetRunPath(assetRunPath)) return false;
  return (
    readWorkbenchFrontmatterValue(content, 'source') === 'desktop-repository-asset-execution-review' &&
    readWorkbenchFrontmatterValue(content, 'assetRunPath') === assetRunPath &&
    readWorkbenchFrontmatterValue(content, 'status') === 'draft'
  );
}

export function isRepositoryAssetRunEffectivelyReviewPending(
  run: RepositoryAssetRunIndexLink,
  documents: WorkbenchReviewDocument[] = [],
): boolean {
  const reviewState = getRepositoryAssetRunEffectiveReviewState(run, documents);
  return Boolean(reviewState && reviewState !== 'confirmed');
}

export function getRepositoryAssetRunEffectiveReviewState(
  run: RepositoryAssetRunIndexLink,
  documents: WorkbenchReviewDocument[] = [],
): RepositoryAssetRunEffectiveReviewState | null {
  const reviewState = findRepositoryAssetRunReviewState(run.path, documents);
  if (reviewState?.status) return reviewState.status;
  return run.reviewPending ? 'pending' : null;
}

export function findRepositoryAssetRunApprovalDecisionState(
  details: RepositoryAssetRunDetails,
  runs: RepositoryAssetRunIndexLink[] = [],
): RepositoryAssetRunApprovalDecisionState | null {
  if (details.status?.trim().toLowerCase() !== 'approval_required') return null;
  if (!details.assetId && !details.assetPath) return null;

  const candidates = runs.filter((run) => {
    if (run.path === details.assetRunPath) return false;
    if (run.approvalState !== 'approved' && run.approvalState !== 'denied') return false;
    if (run.sourceApprovalRunPath) return run.sourceApprovalRunPath === details.assetRunPath;
    if (details.assetId && run.assetId === details.assetId) return true;
    if (details.assetPath && run.assetPath === details.assetPath) return true;
    return false;
  });
  if (candidates.length === 0) return null;

  const latest = [...candidates].sort((left, right) => {
    const leftKey = left.executedAt ?? left.path;
    const rightKey = right.executedAt ?? right.path;
    return rightKey.localeCompare(leftKey);
  })[0];

  return {
    status: latest.approvalState as 'approved' | 'denied',
    runPath: latest.path,
    ...(latest.executedAt ? { decidedAt: latest.executedAt } : {}),
  };
}

export function findRepositoryAssetRunExecutionState(
  details: RepositoryAssetRunDetails,
  runs: RepositoryAssetRunIndexLink[] = [],
): RepositoryAssetRunExecutionState | null {
  if (details.status?.trim().toLowerCase() !== 'approval_required') return null;
  if (!details.assetId && !details.assetPath) return null;

  const candidates = runs.filter((run) => {
    if (run.path === details.assetRunPath) return false;
    const status = run.status?.trim().toLowerCase();
    if (!status || !TERMINAL_REPOSITORY_ASSET_RUN_STATUSES.has(status)) return false;
    if (run.sourceApprovalRunPath) return run.sourceApprovalRunPath === details.assetRunPath;
    if (details.assetId && run.assetId === details.assetId) return true;
    if (details.assetPath && run.assetPath === details.assetPath) return true;
    return false;
  });
  if (candidates.length === 0) return null;

  const latest = [...candidates].sort((left, right) => {
    const leftKey = left.executedAt ?? left.path;
    const rightKey = right.executedAt ?? right.path;
    return rightKey.localeCompare(leftKey);
  })[0];

  return {
    status: latest.status?.trim().toLowerCase() as RepositoryAssetRunExecutionStatus,
    runPath: latest.path,
    ...(latest.executedAt ? { executedAt: latest.executedAt } : {}),
    ...(latest.resultSummary ? { resultSummary: latest.resultSummary } : {}),
    ...(latest.outputState ? { outputState: latest.outputState } : {}),
  };
}

export function getRepositoryAssetRunListFollowUpState(
  run: RepositoryAssetRunIndexLink,
  runs: RepositoryAssetRunIndexLink[] = [],
  context: { actionRuns?: AiActionRun[]; reviewDocuments?: WorkbenchReviewDocument[] } = {},
): RepositoryAssetRunListFollowUpState | null {
  const details: RepositoryAssetRunDetails = {
    assetRunPath: run.path,
    title: run.title,
    ...(run.assetId ? { assetId: run.assetId } : {}),
    ...(run.assetPath ? { assetPath: run.assetPath } : {}),
    ...(run.reuseKind ? { assetReuseKind: run.reuseKind } : {}),
    ...(run.status ? { status: run.status } : {}),
  };
  const approvalDecisionState = findRepositoryAssetRunApprovalDecisionState(details, runs) ?? undefined;
  const executionState = findRepositoryAssetRunExecutionState(details, runs) ?? undefined;
  const knowledgeUpdateState = findRepositoryAssetRunKnowledgeUpdateState(run.path, context);
  const reviewState = findRepositoryAssetRunReviewState(run.path, context.reviewDocuments) ?? undefined;
  if (!approvalDecisionState && !executionState && !knowledgeUpdateState && !reviewState) return null;
  return {
    ...(approvalDecisionState ? { approvalDecisionState } : {}),
    ...(executionState ? { executionState } : {}),
    ...(knowledgeUpdateState ? { knowledgeUpdateState } : {}),
    ...(reviewState ? { reviewState } : {}),
  };
}

export function getRepositoryAssetRunEffectiveApprovalState(
  run: RepositoryAssetRunIndexLink,
  runs: RepositoryAssetRunIndexLink[] = [],
): RepositoryAssetRunApprovalState | null {
  if (run.approvalState === 'approved' || run.approvalState === 'denied') return run.approvalState;
  if (!run.approvalPending) return run.approvalState ?? null;

  const followUpState = getRepositoryAssetRunListFollowUpState(run, runs);
  if (followUpState?.approvalDecisionState) return followUpState.approvalDecisionState.status;
  if (followUpState?.executionState) return null;
  return 'pending';
}

export function getRepositoryAssetRunEffectiveOutputState(
  run: RepositoryAssetRunIndexLink,
  runs: RepositoryAssetRunIndexLink[] = [],
): RepositoryAssetRunOutputState['status'] | null {
  if (run.outputState) return run.outputState;
  const followUpState = getRepositoryAssetRunListFollowUpState(run, runs);
  return followUpState?.executionState?.outputState ?? null;
}

export function getRepositoryAssetRunOutputState(
  details: RepositoryAssetRunDetails,
): RepositoryAssetRunOutputState | null {
  if (details.repositoryOutputPath) {
    return {
      status: 'preserved',
      outputPath: details.repositoryOutputPath,
    };
  }
  if (details.outputArtifactId) {
    return {
      status: 'preserved',
      artifactId: details.outputArtifactId,
    };
  }
  if (
    details.status &&
    TERMINAL_REPOSITORY_ASSET_RUN_STATUSES.has(details.status.trim().toLowerCase()) &&
    details.resultSummary
  ) {
    return { status: 'pending' };
  }
  return null;
}

export function findRepositoryAssetRunFollowUpState(
  assetRunPath: string,
  tailActions: WorkbenchTailAction[] = [],
): RepositoryAssetRunFollowUpState[] {
  if (!isSafeRepositoryAssetRunPath(assetRunPath)) return [];

  return tailActions
    .filter((action) => extractSafeRepositoryAssetRunPathFromText(action.text, action.sourcePath) === assetRunPath)
    .map((action) => ({
      kind: classifyRepositoryAssetRunFollowUp(action.text),
      text: action.text,
      sourcePath: action.sourcePath,
      completed: action.completed,
    }));
}

export function parseRepositoryAssetRunIndexLinks(markdown = ''): RepositoryAssetRunIndexLink[] {
  const links = new Map<string, RepositoryAssetRunIndexLink>();
  let current: {
    title: string;
    href: string;
    assetId?: string;
    reuseKind?: string;
    status?: string;
    metadata: Record<string, string>;
  } | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const path = current.metadata.runPath ? current.metadata.runPath : normalizeRepositoryAssetRunHref(current.href);
    if (!isSafeRepositoryAssetRunPath(path)) return;
    const outputState = deriveRepositoryAssetRunIndexOutputState(current.status, current.metadata);
    const approvalState = deriveRepositoryAssetRunApprovalState(current.status);
    links.set(path, {
      path,
      title: current.title,
      assetId: current.assetId,
      ...(current.metadata.assetPath ? { assetPath: current.metadata.assetPath } : {}),
      reuseKind: current.reuseKind,
      status: current.status,
      ...(current.metadata.approvalTitle ? { approvalTitle: current.metadata.approvalTitle } : {}),
      ...(current.metadata.approvalRisk ? { approvalRisk: current.metadata.approvalRisk } : {}),
      ...(current.metadata.approvalReason ? { approvalReason: current.metadata.approvalReason } : {}),
      ...(isSafeRepositoryAssetRunPath(current.metadata.sourceApprovalRunPath)
        ? { sourceApprovalRunPath: current.metadata.sourceApprovalRunPath }
        : {}),
      ...(approvalState ? { approvalState } : {}),
      ...(approvalState === 'pending' ? { approvalPending: true } : {}),
      ...(outputState ? { outputState } : {}),
      ...(current.metadata.executedAt ? { executedAt: current.metadata.executedAt } : {}),
      ...(current.metadata.result ? { resultSummary: current.metadata.result } : {}),
      ...(current.metadata.workItemPath && isSafeWorkbenchTailActionWorkItemPath(current.metadata.workItemPath)
        ? { workItemPath: current.metadata.workItemPath }
        : {}),
      reviewPending: /\bpending\b/i.test(current.metadata.review ?? ''),
    });
  };

  for (const line of markdown.split('\n')) {
    const runMatch = line.match(/^- \[([^\]]+)]\(([^)]+)\)\s+\(`([^`]+)`,\s*([^,]+),\s*([^)]+)\)/);
    if (runMatch) {
      pushCurrent();
      current = {
        title: runMatch[1].trim(),
        href: runMatch[2].trim(),
        assetId: runMatch[3].trim(),
        reuseKind: runMatch[4].trim(),
        status: runMatch[5].trim(),
        metadata: {},
      };
      continue;
    }

    const metadataMatch = line.match(/^\s+-\s+([^:]+):\s*(.*)$/);
    if (current && metadataMatch) {
      current.metadata[metadataMatch[1].trim()] = metadataMatch[2].trim();
    }
  }
  pushCurrent();

  const barePathPattern = /(^|\s)((?:runs\/assets\/)[^\s)\]]+\.md)(?=$|[\s)])/gm;
  let match: RegExpExecArray | null;
  while ((match = barePathPattern.exec(markdown)) !== null) {
    const path = match[2].trim();
    if (isSafeRepositoryAssetRunPath(path) && !links.has(path)) {
      links.set(path, {
        path,
        title: fileNameFromRepositoryPath(path),
        reviewPending: false,
      });
    }
  }

  return [...links.values()];
}

function deriveRepositoryAssetRunIndexOutputState(
  status: string | undefined,
  metadata: Record<string, string>,
): RepositoryAssetRunOutputState['status'] | undefined {
  if (metadata.output || metadata.outputArtifact || metadata.outputArtifactId || metadata.repositoryOutputPath) {
    return 'preserved';
  }
  if (status && TERMINAL_REPOSITORY_ASSET_RUN_STATUSES.has(status.trim().toLowerCase()) && metadata.result) {
    return 'pending';
  }
  return undefined;
}

function deriveRepositoryAssetRunApprovalState(
  status: string | undefined,
): RepositoryAssetRunApprovalState | undefined {
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'approval_required') return 'pending';
  if (normalized === 'approved') return 'approved';
  if (normalized === 'denied') return 'denied';
  return undefined;
}

function classifyRepositoryAssetRunFollowUp(text: string): RepositoryAssetRunFollowUpKind {
  if (/状态|status/i.test(text)) return 'status';
  if (/成果|产物|output|artifact/i.test(text)) return 'output';
  if (/知识库|知识|wiki|knowledge/i.test(text)) return 'knowledge';
  if (/复盘|review/i.test(text)) return 'review';
  return 'general';
}

function normalizeRepositoryAssetRunHref(href: string): string | undefined {
  const trimmed = href.trim().replace(/^\/+/, '');
  if (trimmed.startsWith('assets/')) {
    const runPath = `runs/${trimmed}`;
    return isSafeRepositoryAssetRunPath(runPath) ? runPath : undefined;
  }
  if (isSafeRepositoryAssetRunPath(trimmed)) return trimmed;
  return undefined;
}

function fileNameFromRepositoryPath(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function isRepositoryExecutableAssetKind(value: string): boolean {
  return ['tool', 'script', 'workflow'].includes(value.trim().toLowerCase());
}

function readBooleanField(content: string, field: string): boolean | null {
  const match = content.match(new RegExp(`^${field}:\\s*(true|false)\\s*$`, 'im'));
  if (!match) return null;
  return match[1] === 'true';
}

export async function completeWorkbenchTailAction(
  binding: RepositoryBinding,
  action: Pick<WorkbenchTailAction, 'id' | 'text' | 'sourcePath'>,
): Promise<boolean> {
  const sourcePath = normalizeWritableWorkbenchMarkdownPath(action.sourcePath);
  const actionIndex = parseTailActionIndex(action.id);
  if (!sourcePath || actionIndex === null) return false;

  const repository = getWorkbenchWriteApi();
  const markdown = await repository.readText(binding.repoPath, sourcePath);
  const next = markWorkbenchTailActionCompleted(markdown, actionIndex, action.text);
  if (!next || next === markdown) return false;

  await repository.writeText(binding.repoPath, sourcePath, next);
  return true;
}

export async function updateWorkbenchMatterStatusFromTailAction(
  binding: RepositoryBinding,
  input: WorkbenchMatterStatusUpdateInput,
): Promise<boolean> {
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(input.workItemPath);
  const actionIndex = parseTailActionIndex(input.tailActionId);
  const status = normalizeWorkbenchMatterStatus(input.status);
  if (!workItemPath || !isPathWithinWorkbenchWorkRoot(binding, workItemPath) || actionIndex === null || !status) {
    return false;
  }

  const repository = getWorkbenchWriteApi();
  const markdown = await repository.readText(binding.repoPath, workItemPath);
  const tailAction = parseWorkbenchTailActions(workItemPath, markdown).find(
    (action) => action.id === input.tailActionId,
  );
  if (!tailAction || tailAction.completed) return false;

  const statusUpdated = markWorkbenchMatterStatus(markdown, status);
  if (!statusUpdated) return false;

  const next = markWorkbenchTailActionCompleted(statusUpdated, actionIndex, tailAction.text);
  if (!next || next === markdown) return false;

  await repository.writeText(binding.repoPath, workItemPath, next);
  return true;
}

export async function archiveCompletedWorkbenchMatter(
  binding: RepositoryBinding,
  input: WorkbenchMatterArchiveInput,
): Promise<WorkbenchMatterArchiveResult> {
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(input.workItemPath);
  const activeRoot = `${normalizeWorkbenchRoot(binding.paths.work)}/active`;
  const completedRoot = `${normalizeWorkbenchRoot(binding.paths.work)}/completed`;
  if (!workItemPath || !isPathWithinRoot(workItemPath, activeRoot)) return { archived: false };

  const repository = getWorkbenchMoveApi();
  const markdown = await repository.readText(binding.repoPath, workItemPath);
  if (!isWorkbenchMatterDone(markdown)) return { archived: false };

  const archivedPath = `${completedRoot}/${workItemPath.slice(`${activeRoot}/`.length)}`;
  if (archivedPath === workItemPath) return { archived: false };

  await repository.moveText(binding.repoPath, workItemPath, archivedPath);
  return { archived: true, archivedPath };
}

export async function confirmWorkbenchKnowledgeTailAction(
  binding: RepositoryBinding,
  input: WorkbenchKnowledgeTailActionConfirmInput,
): Promise<boolean> {
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(input.workItemPath);
  const actionIndex = parseTailActionIndex(input.tailActionId);
  if (!workItemPath || !isPathWithinWorkbenchWorkRoot(binding, workItemPath) || actionIndex === null) return false;

  const repository = getWorkbenchWriteApi();
  const markdown = await repository.readText(binding.repoPath, workItemPath);
  const tailAction = parseWorkbenchTailActions(workItemPath, markdown).find(
    (action) => action.id === input.tailActionId,
  );
  if (!tailAction || tailAction.completed || !isKnowledgeTailActionText(tailAction.text)) return false;

  const next = markWorkbenchTailActionCompleted(markdown, actionIndex, tailAction.text);
  if (!next || next === markdown) return false;

  await repository.writeText(binding.repoPath, workItemPath, next);
  return true;
}

export async function preserveWorkbenchOutputFromTailAction(
  binding: RepositoryBinding,
  input: WorkbenchOutputPreservationInput,
): Promise<boolean> {
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(input.workItemPath);
  if (!workItemPath || !isPathWithinWorkbenchWorkRoot(binding, workItemPath)) return false;

  const tailActionIndex = input.tailActionId ? parseTailActionIndex(input.tailActionId) : null;
  const mustCompleteTailAction = Boolean(input.tailActionId?.includes(':tail-action:'));
  if (mustCompleteTailAction && tailActionIndex === null) return false;

  const repository = getWorkbenchWriteApi();
  const markdown = await repository.readText(binding.repoPath, workItemPath);
  let tailAction: WorkbenchTailAction | undefined;
  if (tailActionIndex !== null) {
    tailAction = parseWorkbenchTailActions(workItemPath, markdown).find((action) => action.id === input.tailActionId);
    if (!tailAction || tailAction.completed) return false;
  }

  let next = appendWorkbenchMatterOutput(markdown, workItemPath, input.artifact);
  if (tailAction && tailActionIndex !== null) {
    const completed = markWorkbenchTailActionCompleted(next, tailActionIndex, tailAction.text);
    if (!completed) return false;
    next = completed;
  }
  if (next === markdown) return false;

  await repository.writeText(binding.repoPath, workItemPath, next);
  return true;
}

export async function applyWorkbenchMatterPlanApproval(
  binding: RepositoryBinding,
  input: WorkbenchMatterPlanApprovalInput,
): Promise<WorkbenchMatterPlanApprovalResult> {
  const planPath = normalizeWritableWorkbenchMarkdownPath(input.repositoryWrite.path);
  const plansActiveRoot = normalizeWorkbenchRoot(`${binding.paths.plans}/active`);
  if (!planPath || !isPathWithinRoot(planPath, plansActiveRoot)) {
    throw new Error(`Approved work-matter plans can only be written under ${plansActiveRoot}/`);
  }

  const writeWorkItemPath = input.repositoryWrite.workItemPath?.trim();
  const expectedWorkItemPath = input.workItemPath?.trim();
  if (writeWorkItemPath && expectedWorkItemPath && writeWorkItemPath !== expectedWorkItemPath) {
    throw new Error('Approved work-matter plan source does not match the ActionRun work item');
  }

  const workItemPath = normalizeWritableWorkbenchMarkdownPath(writeWorkItemPath || expectedWorkItemPath || '');
  const workRoot = normalizeWorkbenchRoot(binding.paths.work);
  if (!workItemPath || !isPathWithinRoot(workItemPath, workRoot)) {
    throw new Error(`Approved work-matter plans must be linked to a work item under ${workRoot}/`);
  }

  const rawPlanContent = input.repositoryWrite.content.trim();
  if (!rawPlanContent) throw new Error('Approved work-matter plan content is empty');

  const repository = getWorkbenchWriteApi();
  const existingPlan = await repository.readText(binding.repoPath, planPath);
  const planContent = addWorkbenchPlanApprovalMetadata(rawPlanContent, {
    actionRunId: input.actionRunId,
    workItemPath,
    approvedAt: input.approvedAt ?? new Date(),
  });
  if (existingPlan.trim() && existingPlan.trim() !== planContent.trim()) {
    throw new Error(`Approved work-matter plan target already exists: ${planPath}`);
  }

  const workMarkdown = await repository.readText(binding.repoPath, workItemPath);
  const nextWorkMarkdown = appendWorkbenchMatterPlan(
    workMarkdown,
    workItemPath,
    planPath,
    planContent,
    input.actionRunId,
  );

  await repository.writeText(binding.repoPath, planPath, planContent);
  if (nextWorkMarkdown !== workMarkdown) {
    await repository.writeText(binding.repoPath, workItemPath, nextWorkMarkdown);
  }

  return { planPath, workItemPath };
}

export async function writeWorkbenchReviewDraft(
  binding: RepositoryBinding,
  input: WorkbenchReviewDraftInput,
): Promise<WorkbenchReviewDraftResult> {
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(input.workItemPath);
  if (!workItemPath || !isPathWithinWorkbenchWorkRoot(binding, workItemPath)) {
    throw new Error('Review draft source must be a work item markdown path');
  }

  const createdAt = input.createdAt ?? new Date();
  const date = createdAt.toISOString().slice(0, 10);
  const workSlug = slugifyPathSegment(workItemPath.replace(/\.md$/i, '').split('/').pop() ?? 'work-item');
  const tailSlug = buildWorkbenchReviewDraftSourceSlug(input.tailActionId);
  const path = `reviews/weekly/${date}-work-${workSlug}-${tailSlug}-review.md`;
  const content = buildWorkbenchReviewDraftMarkdown({
    workItemPath,
    tailActionId: input.tailActionId,
    relatedKnowledgeRunIds: input.relatedKnowledgeRunIds,
    relatedKnowledgeRuns: input.relatedKnowledgeRuns,
    createdAt,
  });

  const repository = getWorkbenchWriteApi();
  const markdown = await repository.readText(binding.repoPath, workItemPath);
  const nextMarkdown = appendWorkbenchMatterReviewDraft(markdown, {
    workItemPath,
    reviewPath: path,
    tailActionId: input.tailActionId,
    createdAt,
  });

  await repository.writeText(binding.repoPath, path, content);
  if (nextMarkdown !== markdown) {
    await repository.writeText(binding.repoPath, workItemPath, nextMarkdown);
  }
  return { path, content };
}

export async function writeWorkbenchAssetRunReviewDraft(
  binding: RepositoryBinding,
  input: WorkbenchAssetRunReviewDraftInput,
): Promise<WorkbenchReviewDraftResult> {
  const assetRunPath = input.assetRunPath;
  if (!isSafeRepositoryAssetRunPath(assetRunPath)) {
    throw new Error('Asset execution review source must be a safe runs/assets markdown path');
  }

  const repository = getWorkbenchWriteApi();
  const runMarkdown = await repository.readText(binding.repoPath, assetRunPath);
  const runFacts = parseWorkbenchAssetRunReviewFacts(assetRunPath, runMarkdown);
  const createdAt = input.createdAt ?? new Date();
  const date = createdAt.toISOString().slice(0, 10);
  const assetSlug = slugifyPathSegment(runFacts.assetId || assetRunPath.split('/').pop()?.replace(/\.md$/i, '') || '');
  const path = `reviews/weekly/${date}-asset-run-${assetSlug}-review.md`;
  const workItemPath = normalizeWorkbenchReviewWorkItemPath(binding, input.workItemPath ?? runFacts.workItemPath);
  const content = buildWorkbenchAssetRunReviewDraftMarkdown({
    ...runFacts,
    assetRunPath,
    workItemPath,
    reviewSummary: input.reviewSummary,
    reuseDecision: input.reuseDecision,
    nextActions: input.nextActions,
    reviewer: input.reviewer,
    createdAt,
  });

  await repository.writeText(binding.repoPath, path, content);

  if (workItemPath) {
    const markdown = await repository.readText(binding.repoPath, workItemPath);
    const nextMarkdown = appendWorkbenchMatterReviewDraft(markdown, {
      workItemPath,
      reviewPath: path,
      sourceLabel: '来源资产运行',
      sourceId: assetRunPath,
      linkLabel: '资产运行复盘草稿',
      createdAt,
    });
    if (nextMarkdown !== markdown) {
      await repository.writeText(binding.repoPath, workItemPath, nextMarkdown);
    }
  }

  return { path, content };
}

export async function confirmWorkbenchReviewDraft(
  binding: RepositoryBinding,
  input: WorkbenchReviewConfirmInput,
): Promise<boolean> {
  const reviewPath = normalizeWritableWorkbenchMarkdownPath(input.reviewPath);
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(input.workItemPath);
  const tailActionIndex = parseTailActionIndex(input.tailActionId);
  if (
    !reviewPath ||
    !reviewPath.startsWith('reviews/') ||
    !workItemPath ||
    !isPathWithinWorkbenchWorkRoot(binding, workItemPath)
  ) {
    return false;
  }

  const repository = getWorkbenchWriteApi();
  if (isActionRunReviewTailActionId(input.tailActionId)) {
    const reviewMarkdown = await repository.readText(binding.repoPath, reviewPath);
    if (!/^status:\s*draft\s*$/m.test(reviewMarkdown)) return false;
    if (readWorkbenchFrontmatterValue(reviewMarkdown, 'source') !== 'desktop-workbench-review-source-execution') {
      return false;
    }
    if (readWorkbenchFrontmatterValue(reviewMarkdown, 'workItemPath') !== workItemPath) return false;
    if (readWorkbenchFrontmatterValue(reviewMarkdown, 'tailActionId') !== input.tailActionId) return false;
    if (readWorkbenchFrontmatterValue(reviewMarkdown, 'sourceExecutionId') !== input.tailActionId) return false;

    const nextReview = markWorkbenchReviewDraftConfirmed(reviewMarkdown, input.reviewedAt ?? new Date());
    if (!nextReview || nextReview === reviewMarkdown) return false;

    await repository.writeText(binding.repoPath, reviewPath, nextReview);
    return true;
  }

  if (tailActionIndex === null) return false;

  const [reviewMarkdown, workMarkdown] = await Promise.all([
    repository.readText(binding.repoPath, reviewPath),
    repository.readText(binding.repoPath, workItemPath),
  ]);
  if (!/^status:\s*draft\s*$/m.test(reviewMarkdown)) return false;
  if (readWorkbenchFrontmatterValue(reviewMarkdown, 'source') !== 'desktop-workbench-review-tail-action') return false;
  if (readWorkbenchFrontmatterValue(reviewMarkdown, 'workItemPath') !== workItemPath) return false;
  if (readWorkbenchFrontmatterValue(reviewMarkdown, 'tailActionId') !== input.tailActionId) return false;

  const tailAction = parseWorkbenchTailActions(workItemPath, workMarkdown).find(
    (action) => action.id === input.tailActionId,
  );
  if (!tailAction || tailAction.completed) return false;

  const nextReview = markWorkbenchReviewDraftConfirmed(reviewMarkdown, input.reviewedAt ?? new Date());
  const nextWork = markWorkbenchTailActionCompleted(workMarkdown, tailActionIndex, tailAction.text);
  if (!nextReview || !nextWork || nextWork === workMarkdown) return false;

  await repository.writeText(binding.repoPath, reviewPath, nextReview);
  await repository.writeText(binding.repoPath, workItemPath, nextWork);
  return true;
}

export async function confirmWorkbenchAssetRunReviewDraft(
  binding: RepositoryBinding,
  input: WorkbenchAssetRunReviewConfirmInput,
): Promise<boolean> {
  const reviewPath = normalizeWritableWorkbenchMarkdownPath(input.reviewPath);
  const assetRunPath = input.assetRunPath;
  if (!reviewPath || !reviewPath.startsWith('reviews/') || !isSafeRepositoryAssetRunPath(assetRunPath)) {
    return false;
  }

  const repository = getWorkbenchWriteApi();
  const reviewMarkdown = await repository.readText(binding.repoPath, reviewPath);
  if (!/^status:\s*draft\s*$/m.test(reviewMarkdown)) return false;
  if (readWorkbenchFrontmatterValue(reviewMarkdown, 'source') !== 'desktop-repository-asset-execution-review') {
    return false;
  }
  if (readWorkbenchFrontmatterValue(reviewMarkdown, 'assetRunPath') !== assetRunPath) return false;

  const nextReview = markWorkbenchReviewDraftConfirmed(reviewMarkdown, input.reviewedAt ?? new Date());
  if (!nextReview || nextReview === reviewMarkdown) return false;

  await repository.writeText(binding.repoPath, reviewPath, nextReview);
  return true;
}

export function parsePlanMetadata(path: string, markdown: string): RepositoryPlanMetadata {
  const metadata: RepositoryPlanMetadata = { path };
  for (const { key, value, source } of parseWorkbenchMetadataEntries(markdown)) {
    if (key === 'status') metadata.status = value;
    if (key === 'approval') metadata.approval = value;
    if (key === 'blockedreason') metadata.blockedReason = value;
    if (key === 'blockerowner') metadata.blockerOwner = value;
    if (key === 'workitempath') metadata.workItemPath = metadata.workItemPath ?? normalizePlanWorkItemPathValue(value);
    if (key === 'dependencies') {
      const dependencies = parseDependencyReferences(value, path);
      metadata.dependencies = appendUniqueDependencies(metadata.dependencies, dependencies);
      metadata.dependencySources = appendDependencySources(metadata.dependencySources, dependencies, source);
    }
  }
  return metadata;
}

function parseWorkbenchMetadataEntries(markdown: string): Array<{ key: string; value: string; source: string }> {
  const entries: Array<{ key: string; value: string; source: string }> = [];
  let listKey: { key: string; source: string } | null = null;

  for (const line of markdown.split('\n').slice(0, 24)) {
    const trimmed = line.trim();
    const currentListKey = listKey;
    if (currentListKey) {
      const listItemMatch = /^\s*-\s+(.+)$/.exec(line);
      if (listItemMatch) {
        entries.push({ key: currentListKey.key, source: currentListKey.source, value: listItemMatch[1].trim() });
        continue;
      }
    }

    const match = /^([^:：]+)[：:]\s*(.*)$/.exec(trimmed);
    if (!match) {
      if (trimmed) listKey = null;
      continue;
    }

    const key = normalizePlanMetadataKey(match[1]);
    const value = match[2].trim();
    const source = match[1].trim();
    if (value) entries.push({ key, source, value });
    listKey = !value && key === 'dependencies' ? { key, source } : null;
  }

  return entries;
}

function normalizePlanWorkItemPathValue(value: string): string {
  return value
    .trim()
    .replace(/^`+|`+$/g, '')
    .trim();
}

function normalizePlanMetadataKey(value: string): string {
  const key = value
    .trim()
    .replace(/^-\s+/, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (key === '状态') return 'status';
  if (key === '审批') return 'approval';
  if (['blockedreason', 'blockreason', 'blocker', 'blockedby', '阻塞原因', '卡住原因', '阻塞', '卡住'].includes(key)) {
    return 'blockedreason';
  }
  if (['blockerowner', 'owner', '负责人', '责任人'].includes(key)) return 'blockerowner';
  if (['workitempath', 'workpath', 'sourceworkitem', 'sourceworkitempath', '事项路径', '来源事项'].includes(key)) {
    return 'workitempath';
  }
  if (
    [
      'dependson',
      'dependencies',
      'dependency',
      'requires',
      'relatedwork',
      'workdependencies',
      'waitingon',
      'waitingfor',
      '等待',
      '等待于',
      '等待事项',
      '依赖',
      '依赖事项',
      '关联事项',
      '前置事项',
    ].includes(key)
  ) {
    return 'dependencies';
  }
  return key;
}

function parseDependencyReferences(value: string, sourcePath: string): string[] {
  const listValue = unwrapInlineDependencyList(value);
  return listValue
    .split(/[,，;；]/)
    .map((part) => extractMarkdownLinkHref(part) ?? part)
    .map((part) => part.trim())
    .map(extractDependencyObjectValue)
    .map(stripDependencyReferenceQuotes)
    .map((part) => normalizeDependencyReference(part, sourcePath))
    .filter(isTrustedWorkbenchDependencyReference)
    .filter(Boolean);
}

function appendUniqueDependencies(existing: string[] | undefined, next: string[]): string[] {
  const dependencies = [...(existing ?? [])];
  const seen = new Set(dependencies);
  for (const dependency of next) {
    if (seen.has(dependency)) continue;
    seen.add(dependency);
    dependencies.push(dependency);
  }
  return dependencies;
}

function appendDependencySources(
  existing: Record<string, string> | undefined,
  dependencies: string[],
  source: string,
): Record<string, string> | undefined {
  if (dependencies.length === 0) return existing;
  const dependencySources = { ...(existing ?? {}) };
  const normalizedSource = source.trim();
  for (const dependency of dependencies) {
    if (!normalizedSource || dependencySources[dependency]) continue;
    dependencySources[dependency] = normalizedSource;
  }
  return dependencySources;
}

function unwrapInlineDependencyList(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']') && !/\]\s*\(/.test(trimmed)) {
    return trimmed.slice(1, -1);
  }
  return value;
}

function stripDependencyReferenceQuotes(value: string): string {
  return value.replace(/^["'`]+|["'`]+$/g, '').trim();
}

function extractDependencyObjectValue(value: string): string {
  const match = /^([^:：]+)[：:]\s*(.+)$/.exec(value.trim());
  if (!match) return value;
  const key = normalizePlanMetadataKey(match[1]);
  if (['path', 'workitempath', 'planpath', 'workpath', '事项路径', '计划路径'].includes(key)) {
    return match[2].trim();
  }
  return value;
}

function extractMarkdownLinkHref(value: string): string | undefined {
  return /\[[^\]]+]\(([^)]+)\)/.exec(value)?.[1]?.trim();
}

function normalizeDependencyReference(value: string, sourcePath: string): string {
  if (!value || value.startsWith('#') || value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (!value.includes('/') && !value.startsWith('.')) return value;

  const base = sourcePath.split('/').slice(0, -1);
  const segments = (value.startsWith('.') ? [...base, ...value.split('/')] : value.split('/')).filter(Boolean);
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === '.') continue;
    if (segment === '..') {
      if (normalized.length === 0) return value;
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }
  return normalized.join('/');
}

function isTrustedWorkbenchDependencyReference(value: string): boolean {
  return isSafeWorkbenchMarkdownPath(value) && isSafeWorkbenchMatterLikePath(value);
}

async function loadWorkbenchTailActions(
  binding: RepositoryBinding,
  workFiles: RepositoryMarkdownFile[],
): Promise<WorkbenchTailAction[]> {
  const repository = getWorkbenchReadApi();
  const groups = await Promise.all(
    workFiles.map(async (file) =>
      parseWorkbenchTailActions(file.path, await repository.readText(binding.repoPath, file.path), file.updatedAt),
    ),
  );
  return groups.flat();
}

export function parseWorkbenchTailActions(sourcePath: string, markdown: string, updatedAt = 0): WorkbenchTailAction[] {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === '## 收尾动作');
  if (headerIndex === -1) return [];

  const actions: WorkbenchTailAction[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (/^#{1,6}\s+/.test(trimmed)) break;
    const match = /^-\s+\[([ xX])\]\s+(.+)$/.exec(trimmed);
    if (!match) continue;
    const text = match[2]?.trim();
    if (!text || text.startsWith('暂无')) continue;
    actions.push({
      id: `${sourcePath}:tail-action:${actions.length}`,
      text,
      sourcePath,
      completed: match[1]?.toLowerCase() === 'x',
      updatedAt,
    });
  }
  return actions;
}

async function loadWorkbenchReviewDocuments(
  binding: RepositoryBinding,
  reviews: RepositoryMarkdownFile[],
): Promise<WorkbenchReviewDocument[]> {
  const repository = getWorkbenchReadApi();
  return Promise.all(
    reviews.map(async (file) => {
      const content = await repository.readText(binding.repoPath, file.path);
      return {
        path: file.path,
        title: extractTitle(content) || file.name,
        content,
        file,
      };
    }),
  );
}

function markWorkbenchTailActionCompleted(markdown: string, actionIndex: number, expectedText: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === '## 收尾动作');
  if (headerIndex === -1) return null;

  let currentIndex = 0;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (/^#{1,6}\s+/.test(trimmed)) break;
    const match = /^(\s*-\s+\[)([ xX])(\]\s+)(.+)$/.exec(lines[index]);
    if (!match) continue;

    if (currentIndex === actionIndex) {
      const text = match[4]?.trim();
      if (text !== expectedText.trim() || match[2]?.toLowerCase() === 'x') return null;
      lines[index] = `${match[1]}x${match[3]}${match[4]}`;
      return lines.join('\n');
    }
    currentIndex += 1;
  }
  return null;
}

function markWorkbenchMatterStatus(markdown: string, status: string): string | null {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (endIndex === -1) return null;
    const statusIndex = lines.findIndex((line, index) => index > 0 && index < endIndex && /^status:\s*/.test(line));
    if (statusIndex === -1) lines.splice(endIndex, 0, `status: ${status}`);
    else lines[statusIndex] = `status: ${status}`;
    return lines.join('\n');
  }

  const statusIndex = lines.findIndex((line) => /^状态[：:]\s*/.test(line.trim()));
  if (statusIndex !== -1) {
    const indent = lines[statusIndex].match(/^\s*/)?.[0] ?? '';
    lines[statusIndex] = `${indent}状态：${status}`;
    return lines.join('\n');
  }

  return ['---', `status: ${status}`, '---', '', markdown].join('\n');
}

function appendWorkbenchMatterOutput(
  markdown: string,
  workItemPath: string,
  artifact: WorkbenchOutputPreservationInput['artifact'],
): string {
  const artifactReference = artifact.repositoryOutputPath ?? `artifact://${artifact.id}`;
  if (markdown.includes(`artifact://${artifact.id}`) || markdown.includes(artifactReference)) return markdown;

  const outputLine = buildWorkbenchMatterOutputLine(workItemPath, artifact, artifactReference);
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === '## 关联成果');
  if (headerIndex === -1) return `${markdown.trimEnd()}\n\n## 关联成果\n\n${outputLine.join('\n')}\n`;

  let insertIndex = headerIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') insertIndex += 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '- 暂无') {
    lines.splice(insertIndex, 1);
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') lines.splice(insertIndex, 1);
  }
  const insertLines = [...outputLine];
  if (/^#{1,6}\s+/.test(lines[insertIndex]?.trim() ?? '')) insertLines.push('');
  lines.splice(insertIndex, 0, ...insertLines);
  return lines.join('\n').trimEnd();
}

function buildWorkbenchMatterOutputLine(
  workItemPath: string,
  artifact: WorkbenchOutputPreservationInput['artifact'],
  artifactReference: string,
): string[] {
  const href = artifact.repositoryOutputPath
    ? relativeWorkbenchMarkdownLink(workItemPath, artifact.repositoryOutputPath)
    : artifactReference;
  const lines = [`- [${escapeMarkdownLinkText(artifact.title)}](${href}) (\`${artifact.id}\`, ${artifact.type})`];
  if (artifact.repositoryPreviewPath) lines.push(`  - preview: ${artifact.repositoryPreviewPath}`);
  return lines;
}

function appendWorkbenchMatterReviewDraft(
  markdown: string,
  input: {
    workItemPath: string;
    reviewPath: string;
    tailActionId?: string;
    sourceLabel?: string;
    sourceId?: string;
    linkLabel?: string;
    createdAt: Date;
  },
): string {
  const href = relativeWorkbenchMarkdownLink(input.workItemPath, input.reviewPath);
  if (markdown.includes(input.reviewPath) || markdown.includes(href)) return markdown;

  const sourceLabel =
    input.sourceLabel ?? (isActionRunReviewTailActionId(input.tailActionId) ? '来源执行记录' : '来源尾动作');
  const sourceId = input.sourceId ?? input.tailActionId;
  const sourceSuffix = sourceId ? ` - ${sourceLabel}: \`${sourceId}\`` : '';
  const linkLabel = input.linkLabel ?? '复盘草稿';
  const reviewLine = `- [${input.createdAt.toISOString().slice(0, 10)} ${linkLabel}](${href})${sourceSuffix}`;
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === '## 复盘');
  if (headerIndex === -1) return `${markdown.trimEnd()}\n\n## 复盘\n\n${reviewLine}\n`;

  let insertIndex = headerIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') insertIndex += 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '- 暂无') {
    lines.splice(insertIndex, 1);
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') lines.splice(insertIndex, 1);
  }
  const insertLines = [reviewLine];
  if (/^#{1,6}\s+/.test(lines[insertIndex]?.trim() ?? '')) insertLines.push('');
  lines.splice(insertIndex, 0, ...insertLines);
  return lines.join('\n').trimEnd();
}

function appendWorkbenchMatterPlan(
  markdown: string,
  workItemPath: string,
  planPath: string,
  planContent: string,
  actionRunId: string,
): string {
  const href = relativeWorkbenchMarkdownLink(workItemPath, planPath);
  if (markdown.includes(planPath) || markdown.includes(href)) return markdown;

  const title = extractTitle(planContent) || planPath.split('/').pop()?.replace(/\.md$/i, '') || '事项计划';
  const planLine = `- [${escapeMarkdownLinkText(title)}](${href}) - action: \`${actionRunId}\``;
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === '## 关联计划');
  if (headerIndex === -1) return `${markdown.trimEnd()}\n\n## 关联计划\n\n${planLine}\n`;

  let insertIndex = headerIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') insertIndex += 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '- 暂无') {
    lines.splice(insertIndex, 1);
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') lines.splice(insertIndex, 1);
  }
  const insertLines = [planLine];
  if (/^#{1,6}\s+/.test(lines[insertIndex]?.trim() ?? '')) insertLines.push('');
  lines.splice(insertIndex, 0, ...insertLines);
  return lines.join('\n').trimEnd();
}

function addWorkbenchPlanApprovalMetadata(
  markdown: string,
  input: { actionRunId: string; workItemPath: string; approvedAt: Date },
): string {
  const fields = {
    source: 'work_matter_plan',
    workItemPath: input.workItemPath,
    actionRunId: input.actionRunId,
    approval: 'approved',
    approvedAt: input.approvedAt.toISOString(),
  };
  return upsertMarkdownFrontmatter(markdown.trim(), fields);
}

function upsertMarkdownFrontmatter(markdown: string, fields: Record<string, string>): string {
  const lines = markdown.split(/\r?\n/);
  const fieldEntries = Object.entries(fields);
  if (lines[0]?.trim() === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (endIndex > 0) {
      const frontmatter = lines.slice(1, endIndex);
      for (const [key, value] of fieldEntries) {
        const existingIndex = frontmatter.findIndex((line) => new RegExp(`^${escapeRegExp(key)}\\s*:`).test(line));
        if (existingIndex === -1) frontmatter.push(`${key}: ${value}`);
        else frontmatter[existingIndex] = `${key}: ${value}`;
      }
      return ['---', ...frontmatter, '---', ...lines.slice(endIndex + 1)].join('\n').trimEnd();
    }
  }

  return ['---', ...fieldEntries.map(([key, value]) => `${key}: ${value}`), '---', '', markdown].join('\n').trimEnd();
}

function normalizeWorkbenchRoot(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function isPathWithinRoot(path: string, root: string): boolean {
  return Boolean(path && root && path === root) || path.startsWith(`${root}/`);
}

function isPathWithinWorkbenchWorkRoot(binding: RepositoryBinding, path: string): boolean {
  const workRoot = normalizeWorkbenchRoot(binding.paths.work);
  return isPathWithinRoot(path, workRoot);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeRepositoryAssetKnowledgeUpdateStatus(
  run: AiActionRun,
): RepositoryAssetRunKnowledgeUpdateState['status'] {
  if (run.status === 'failed') return 'failed';
  if (run.status === 'cancelled') return 'cancelled';
  if (run.status === 'awaiting_approval') return 'awaiting_approval';
  if (run.status === 'done') return isNoWriteNeededKnowledgeRun(run) ? 'no_write_needed' : 'done';
  return 'running';
}

function isNoWriteNeededKnowledgeRun(run: AiActionRun): boolean {
  const text = [run.lastAssistantResponse, run.resultSummary].filter(Boolean).join('\n');
  return /"kind"\s*:\s*"no_write_needed"|no_write_needed|无需写入|不需要写入|no write needed/i.test(text);
}

function hasSourceExecutionReference(text: string, sourceExecutionId: string): boolean {
  const escapedSourceExecutionId = escapeRegExp(sourceExecutionId);
  return new RegExp(`(^|[^A-Za-z0-9._~:/-])${escapedSourceExecutionId}($|[^A-Za-z0-9._~:/-])`).test(text);
}

function parseTailActionIndex(id: string): number | null {
  const match = /:tail-action:(\d+)$/.exec(id);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function normalizeWorkbenchMatterStatus(value: string): string | null {
  const status = value.trim();
  if (!WORKBENCH_MATTER_STATUSES.has(status)) return null;
  return status;
}

function isWorkbenchMatterDone(markdown: string): boolean {
  const frontmatterStatus = readWorkbenchFrontmatterValue(markdown, 'status')?.toLowerCase();
  if (frontmatterStatus === 'done') return true;
  return /^状态[：:]\s*(done|已完成|完成)\s*$/im.test(markdown);
}

function isKnowledgeTailActionText(text: string): boolean {
  return /知识库|知识|wiki|knowledge/i.test(text);
}

function relativeWorkbenchMarkdownLink(fromPath: string, toPath: string): string {
  const from = fromPath.split('/').slice(0, -1);
  const to = toPath.split('/');
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) common += 1;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].join('/');
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/[[\]]/g, '');
}

function normalizeWritableWorkbenchMarkdownPath(value: string): string | null {
  const path = value.trim().replace(/^\/+/, '');
  const segments = path.split('/');
  if (!path.endsWith('.md') || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }
  return path;
}

function slugifyPathSegment(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'work-item';
}

function isActionRunReviewTailActionId(value?: string): value is string {
  return Boolean(value?.startsWith('action-run-review:'));
}

function buildWorkbenchReviewDraftSourceSlug(tailActionId?: string): string {
  if (!tailActionId) return 'tail-action';
  if (isActionRunReviewTailActionId(tailActionId)) return slugifyPathSegment(tailActionId);
  const tailActionIndex = parseTailActionIndex(tailActionId);
  return tailActionIndex === null ? 'tail-action' : `tail-action-${tailActionIndex}`;
}

function buildWorkbenchReviewDraftMarkdown(input: {
  workItemPath: string;
  tailActionId?: string;
  relatedKnowledgeRunIds?: string[];
  relatedKnowledgeRuns?: WorkbenchReviewDraftKnowledgeRun[];
  createdAt: Date;
}): string {
  const sourceExecutionId = isActionRunReviewTailActionId(input.tailActionId) ? input.tailActionId : undefined;
  const relatedKnowledgeRuns = dedupeRelatedKnowledgeRuns(input.relatedKnowledgeRuns);
  const relatedKnowledgeRunIds = dedupeRelatedRunIds([
    ...(input.relatedKnowledgeRunIds ?? []),
    ...relatedKnowledgeRuns.map((run) => run.id),
  ]);
  const relatedKnowledgeWritePathLines = buildRelatedKnowledgeWritePathLines(relatedKnowledgeRuns);
  return [
    '---',
    sourceExecutionId
      ? 'source: desktop-workbench-review-source-execution'
      : 'source: desktop-workbench-review-tail-action',
    `workItemPath: ${input.workItemPath}`,
    input.tailActionId ? `tailActionId: ${input.tailActionId}` : undefined,
    sourceExecutionId ? `sourceExecutionId: ${sourceExecutionId}` : undefined,
    relatedKnowledgeRunIds.length ? `relatedKnowledgeRunIds: ${relatedKnowledgeRunIds.join(', ')}` : undefined,
    `createdAt: ${input.createdAt.toISOString()}`,
    'status: draft',
    '---',
    '',
    `# ${input.workItemPath.split('/').pop()?.replace(/\.md$/i, '') ?? '工作事项'} 复盘草稿`,
    '',
    `来源事项: \`${input.workItemPath}\``,
    sourceExecutionId
      ? `来源执行记录: \`${sourceExecutionId}\``
      : input.tailActionId
        ? `来源尾动作: \`${input.tailActionId}\``
        : undefined,
    relatedKnowledgeRunIds.length
      ? `相关知识更新 ActionRun: ${relatedKnowledgeRunIds.map((id) => `\`${id}\``).join(', ')}`
      : undefined,
    relatedKnowledgeRuns.length ? '' : undefined,
    relatedKnowledgeRuns.length ? '## 相关知识更新' : undefined,
    relatedKnowledgeRuns.length ? '' : undefined,
    relatedKnowledgeRuns.length ? '| ActionRun | 状态 | 摘要 |' : undefined,
    relatedKnowledgeRuns.length ? '| --- | --- | --- |' : undefined,
    ...relatedKnowledgeRuns.map(
      (run) =>
        `| \`${run.id}\` | ${formatReviewTableCell(run.status)} | ${formatReviewTableCell(run.resultSummary ?? run.error ?? '暂无摘要')} |`,
    ),
    relatedKnowledgeWritePathLines.length ? '' : undefined,
    ...relatedKnowledgeWritePathLines,
    '',
    '## 核对清单',
    '',
    '- [ ] 核对来源事项目标、验收标准和当前状态。',
    '- [ ] 核对关联执行记录、运行摘要和错误信息。',
    '- [ ] 核对已经沉淀的成果、产物或 Repository output。',
    '- [ ] 判断是否需要更新知识库、计划或后续事项。',
    relatedKnowledgeRunIds.length
      ? '- [ ] 核对相关知识更新 ActionRun 是否已写入 Wiki/index/log 或确认无需写入。'
      : undefined,
    '- [ ] 判断是否需要把该尾动作标记完成。',
    '',
    '## 复盘正文',
    '',
    '- 背景：',
    '- 本次推进：',
    '- 产生的成果：',
    '- 风险和遗留问题：',
    '- 下一步：',
    '',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

interface WorkbenchAssetRunReviewFacts {
  assetRunPath: string;
  title: string;
  assetId?: string;
  assetPath?: string;
  assetReuseKind?: string;
  status?: string;
  approvalTitle?: string;
  approvalRisk?: string;
  approvalReason?: string;
  runner?: string;
  command?: string;
  repositoryOutputPath?: string;
  outputArtifactId?: string;
  workItemPath?: string;
  executedAt?: string;
  resultSummary?: string;
}

function parseWorkbenchAssetRunReviewFacts(
  assetRunPath: string,
  markdown: string,
): Omit<WorkbenchAssetRunReviewFacts, 'assetRunPath'> {
  if (readWorkbenchFrontmatterValue(markdown, 'source') !== 'desktop-repository-asset-execution') {
    throw new Error('Asset execution review source must be a desktop repository asset execution record');
  }

  const title = extractWorkbenchAssetRunTitle(markdown);
  return {
    title: title || readWorkbenchFrontmatterValue(markdown, 'assetId') || assetRunPath,
    assetId: readWorkbenchFrontmatterValue(markdown, 'assetId') ?? undefined,
    assetPath: readWorkbenchFrontmatterValue(markdown, 'assetPath') ?? undefined,
    assetReuseKind: readWorkbenchFrontmatterValue(markdown, 'assetReuseKind') ?? undefined,
    status: readWorkbenchFrontmatterValue(markdown, 'status') ?? undefined,
    approvalTitle: readWorkbenchFrontmatterValue(markdown, 'approvalTitle') ?? undefined,
    approvalRisk: readWorkbenchFrontmatterValue(markdown, 'approvalRisk') ?? undefined,
    approvalReason: readWorkbenchFrontmatterValue(markdown, 'approvalReason') ?? undefined,
    runner: readWorkbenchFrontmatterValue(markdown, 'runner') ?? undefined,
    command: readWorkbenchFrontmatterValue(markdown, 'command') ?? undefined,
    repositoryOutputPath: readWorkbenchFrontmatterValue(markdown, 'repositoryOutputPath') ?? undefined,
    outputArtifactId: readWorkbenchFrontmatterValue(markdown, 'outputArtifactId') ?? undefined,
    workItemPath: readWorkbenchFrontmatterValue(markdown, 'workItemPath') ?? undefined,
    executedAt: readWorkbenchFrontmatterValue(markdown, 'executedAt') ?? undefined,
    resultSummary: extractWorkbenchAssetRunResultSummary(markdown),
  };
}

function buildWorkbenchAssetRunReviewDraftMarkdown(
  input: WorkbenchAssetRunReviewFacts & {
    workItemPath?: string;
    reviewSummary?: string;
    reuseDecision?: string;
    nextActions?: string[];
    reviewer?: string;
    createdAt: Date;
  },
): string {
  const nextActions = input.nextActions?.filter((action) => action.trim().length > 0) ?? [];
  return [
    '---',
    `title: ${JSON.stringify(`仓库资产执行复盘 ${input.createdAt.toISOString().slice(0, 10)} - ${input.title}`)}`,
    'source: desktop-repository-asset-execution-review',
    `assetRunPath: ${input.assetRunPath}`,
    input.assetId ? `assetId: ${input.assetId}` : undefined,
    input.assetPath ? `assetPath: ${input.assetPath}` : undefined,
    input.assetReuseKind ? `assetReuseKind: ${input.assetReuseKind}` : undefined,
    input.status ? `executionStatus: ${input.status}` : undefined,
    input.repositoryOutputPath ? `repositoryOutputPath: ${input.repositoryOutputPath}` : undefined,
    input.outputArtifactId ? `outputArtifactId: ${input.outputArtifactId}` : undefined,
    input.workItemPath ? `workItemPath: ${input.workItemPath}` : undefined,
    input.reviewer ? `reviewer: ${input.reviewer}` : undefined,
    `createdAt: ${input.createdAt.toISOString()}`,
    'status: draft',
    'recordOnly: true',
    'desktopExecutes: false',
    'grantsPermission: false',
    '---',
    '',
    `# 仓库资产执行复盘：${input.title}`,
    '',
    `来源运行: \`${input.assetRunPath}\``,
    input.workItemPath ? `关联事项: \`${input.workItemPath}\`` : undefined,
    '',
    '## 执行事实',
    '',
    input.assetId ? `- 资产：${input.assetId}` : undefined,
    input.assetPath ? `- 路径：${input.assetPath}` : undefined,
    input.assetReuseKind ? `- 类型：${input.assetReuseKind}` : undefined,
    input.status ? `- 状态：${input.status}` : undefined,
    input.executedAt ? `- 执行时间：${input.executedAt}` : undefined,
    input.runner ? `- 运行器：${input.runner}` : undefined,
    input.command ? `- 命令：\`${input.command}\`` : undefined,
    input.resultSummary ? `- 执行结果：${input.resultSummary}` : undefined,
    input.outputArtifactId ? `- 输出产物：artifact://${input.outputArtifactId}` : undefined,
    input.repositoryOutputPath ? `- 仓库输出：${input.repositoryOutputPath}` : undefined,
    '',
    '## 核对清单',
    '',
    '- [ ] 判断本次运行结果是否应该沉淀为成果或关联到既有成果。',
    '- [ ] 判断该资产是否继续复用、需要改进、还是暂停使用。',
    '- [ ] 判断是否需要更新来源事项状态、知识库、计划或后续事项。',
    '- [ ] 确认 Desktop 只写入复盘记录，不执行资产、不授予权限。',
    '',
    '## 复盘正文',
    '',
    `- 本次推进：${input.reviewSummary ?? ''}`,
    `- 复用判断：${input.reuseDecision ?? ''}`,
    '- 产生的成果：',
    '- 风险和遗留问题：',
    '- 下一步：',
    ...nextActions.map((action) => `  - ${action}`),
    '',
    '## 边界',
    '',
    '- Desktop 只写入复盘记录，不执行资产、不授予权限。',
    '- 后续状态更新、成果沉淀、知识库更新仍需要用户显式确认。',
    '',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function normalizeWorkbenchReviewWorkItemPath(binding: RepositoryBinding, value?: string): string | undefined {
  if (!value) return undefined;
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(value);
  return workItemPath && isPathWithinWorkbenchWorkRoot(binding, workItemPath) ? workItemPath : undefined;
}

function extractWorkbenchAssetRunTitle(markdown: string): string {
  const headingTitle = /^#\s+仓库资产执行[：:]\s*(.+)$/m.exec(markdown)?.[1]?.trim();
  if (headingTitle) return headingTitle;
  const frontmatterTitle = readWorkbenchFrontmatterValue(markdown, 'title') ?? '';
  return frontmatterTitle.replace(/^仓库资产执行\s*[-：:]\s*/, '').trim();
}

function extractWorkbenchAssetRunResultSummary(markdown: string): string | undefined {
  return /^-\s*执行结果[：:]\s*(.+)$/m.exec(markdown)?.[1]?.trim();
}

function dedupeRelatedRunIds(values?: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function dedupeRelatedKnowledgeRuns(values?: WorkbenchReviewDraftKnowledgeRun[]): WorkbenchReviewDraftKnowledgeRun[] {
  const seen = new Set<string>();
  const result: WorkbenchReviewDraftKnowledgeRun[] = [];
  for (const value of values ?? []) {
    const id = value.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ ...value, id });
  }
  return result;
}

function buildRelatedKnowledgeWritePathLines(values: WorkbenchReviewDraftKnowledgeRun[]): string[] {
  return values.flatMap((run) => {
    if (run.status !== 'done') return [];
    const paths = extractKnowledgeWritePaths(run.resultSummary);
    if (paths.length === 0) return [];
    return [`- \`${run.id}\` 写入路径: ${paths.map((path) => `\`${path}\``).join(', ')}`];
  });
}

function extractKnowledgeWritePaths(value?: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const matches = value?.match(/wiki\/[^\s`"'，,、。；;）)\]}]+\.md/g) ?? [];
  for (const match of matches) {
    const path = normalizeWritableWorkbenchMarkdownPath(match);
    if (!path?.startsWith('wiki/') || seen.has(path)) continue;
    seen.add(path);
    result.push(path);
  }
  return result;
}

function formatReviewTableCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function markWorkbenchReviewDraftConfirmed(markdown: string, reviewedAt: Date): string | null {
  if (!/^---\n/.test(markdown)) return null;
  const lines = markdown.split(/\r?\n/);
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (endIndex === -1) return null;

  let statusUpdated = false;
  let reviewedAtIndex = -1;
  for (let index = 1; index < endIndex; index += 1) {
    if (/^status:\s*/.test(lines[index])) {
      if (!/^status:\s*draft\s*$/.test(lines[index])) return null;
      lines[index] = 'status: confirmed';
      statusUpdated = true;
    }
    if (/^reviewedAt:\s*/.test(lines[index])) reviewedAtIndex = index;
  }
  if (!statusUpdated) return null;

  const reviewedAtLine = `reviewedAt: ${reviewedAt.toISOString()}`;
  if (reviewedAtIndex === -1) lines.splice(endIndex, 0, reviewedAtLine);
  else lines[reviewedAtIndex] = reviewedAtLine;
  return lines.join('\n');
}

function readWorkbenchFrontmatterValue(markdown: string, key: string): string | null {
  if (!/^---\n/.test(markdown)) return null;
  const lines = markdown.split(/\r?\n/);
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (endIndex === -1) return null;

  const prefix = `${key}:`;
  const line = lines.slice(1, endIndex).find((item) => item.startsWith(prefix));
  if (!line) return null;

  const value = line.slice(prefix.length).trim();
  return value.replace(/^["'](.+)["']$/, '$1');
}

export function deriveProjects(section?: WorkbenchSemanticSection): WorkbenchProject[] {
  if (!section) return [];
  return section.documents
    .filter((document) => isProjectEntryDocument(document.path))
    .map((document) => ({
      id: document.path,
      name: extractTitle(document.content) || projectNameFromPath(document.path),
      path: document.path,
      status: extractStatus(document.content),
      summary: extractSummary(document.content),
      updatedAt: document.file.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

export function deriveTaskGroup(
  id: WorkbenchTaskGroup['id'],
  section?: WorkbenchSemanticSection,
): WorkbenchTaskGroup | null {
  if (!section) return null;
  const items = section.documents.flatMap((document) => extractTaskItems(document.content, id, document.path));
  return {
    id,
    title: section.title || taskGroupFallbackTitle(id),
    path: section.paths[0] ?? '',
    items,
  };
}

function extractTitle(content: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

function extractStatus(content: string): string {
  return content.match(/状态[：:]\s*([^\n]+)/)?.[1]?.trim() ?? '未标记';
}

function extractSummary(content: string): string {
  const line = content
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith('#') && !item.startsWith('|') && !item.startsWith('-'));
  return line ?? '暂无摘要';
}

function extractTaskItems(content: string, groupId: WorkbenchTaskGroup['id'], sourcePath: string): WorkbenchTaskItem[] {
  const items = content
    .split('\n')
    .map((line) => line.trim())
    .map((line) => {
      const match = /^-\s+(?:\[([ xX])\]\s+)?(.+)$/.exec(line);
      if (!match) return null;
      const text = match[2]?.trim();
      if (!text || text.startsWith('暂无')) return null;
      const checked = match[1]?.toLowerCase() === 'x';
      if (groupId === 'done' && !checked) return null;
      return {
        text,
        completed: groupId === 'done' || checked,
      };
    })
    .filter((item): item is { text: string; completed: boolean } => Boolean(item));

  return items.map((item, index) => ({
    id: `${sourcePath}:${index}`,
    text: item.text,
    sourcePath,
    completed: item.completed,
  }));
}

function isProjectEntryDocument(path: string): boolean {
  return path.split('/').length >= 3 && /(^|\/)(README|brief|PRD)\.md$/i.test(path);
}

function projectNameFromPath(path: string): string {
  const parts = path.split('/');
  if (parts.length >= 2) return parts[parts.length - 2] || path;
  return path.replace(/\.md$/i, '');
}

function taskGroupFallbackTitle(id: WorkbenchTaskGroup['id']): string {
  if (id === 'current') return '正在进行';
  if (id === 'next') return '接下来';
  return '已完成';
}

export function groupReviewsByFolder(reviews: RepositoryMarkdownFile[]): RepositoryReviewGroup[] {
  const groups = new Map<string, RepositoryMarkdownFile[]>();
  for (const file of reviews) {
    const parts = file.path.split('/');
    const group = parts.length > 2 ? parts[1] : 'root';
    groups.set(group, [...(groups.get(group) ?? []), file]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, files]) => ({
      group,
      files: [...files].sort((a, b) => b.updatedAt - a.updatedAt),
    }));
}

function getWorkbenchReadApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.listMarkdown || !repository.readText) {
    throw new Error('electronAPI.repository workbench methods not available');
  }
  return {
    listMarkdown: repository.listMarkdown,
    readText: repository.readText,
  };
}

function getWorkbenchTextApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.readText) {
    throw new Error('electronAPI.repository workbench text method not available');
  }
  return {
    readText: repository.readText,
  };
}

function getWorkbenchWriteApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.readText || !repository.writeText) {
    throw new Error('electronAPI.repository workbench write methods not available');
  }
  return {
    readText: repository.readText,
    writeText: repository.writeText,
  };
}

function getWorkbenchMoveApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.readText || !repository.moveText) {
    throw new Error('electronAPI.repository workbench move methods not available');
  }
  return {
    readText: repository.readText,
    moveText: repository.moveText,
  };
}
