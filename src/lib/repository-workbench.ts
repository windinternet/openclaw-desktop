import type { RepositoryBinding, SemanticSlot } from './agentic-repository';
import type { ArtifactMeta } from './artifact-types';
import type { RepositoryMarkdownFile } from './repository-knowledge';
import type { AiActionRepositoryWrite } from './types';

const WORKBENCH_MATTER_STATUSES = new Set(['active', 'blocked', 'done', 'paused']);

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
  createdAt?: Date;
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
  reviewGroups: RepositoryReviewGroup[];
  semanticSections: WorkbenchSemanticSection[];
  projects: WorkbenchProject[];
  taskGroups: WorkbenchTaskGroup[];
  tailActions: WorkbenchTailAction[];
}

export interface RepositoryPlanMetadata {
  path: string;
  status?: string;
  approval?: string;
  blockedReason?: string;
  blockerOwner?: string;
  workItemPath?: string;
  dependencies?: string[];
}

export interface RepositoryReviewGroup {
  group: string;
  files: RepositoryMarkdownFile[];
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
    repository.readText(binding.repoPath, `${binding.paths.outputs}/index.md`),
    repository.listMarkdown(binding.repoPath, binding.paths.reviews),
  ]);
  const runsMarkdown = [runsIndexMarkdown, actionRunsIndexMarkdown].filter((part) => part.trim()).join('\n\n');

  const [planMetadata, tailActions, reviewDocuments] = await Promise.all([
    Promise.all(
      [...activePlans, ...completedPlans].map(async (file) =>
        parsePlanMetadata(file.path, await repository.readText(binding.repoPath, file.path)),
      ),
    ),
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
    reviewGroups: groupReviewsByFolder(reviews),
    semanticSections: [],
    projects: [],
    taskGroups: [],
    tailActions,
  };
}

async function loadSemanticWorkbenchSnapshot(binding: RepositoryBinding): Promise<WorkbenchSnapshot> {
  const semanticSections = await loadSemanticSections(binding);
  const sectionByKey = new Map(semanticSections.map((section) => [section.key, section]));
  const reviewSection = semanticSections.find((section) => section.key === 'reviews');
  const reviews = reviewSection?.files ?? [];
  const reviewDocuments = reviewSection?.documents ?? [];
  const tailActions = semanticSections.flatMap((section) =>
    section.documents.flatMap((document) =>
      parseWorkbenchTailActions(document.path, document.content, document.file.updatedAt),
    ),
  );
  return {
    inboxMarkdown: sectionByKey.get('inbox')?.markdown ?? '',
    activeWork: sectionByKey.get('current')?.files ?? [],
    completedWork: sectionByKey.get('done')?.files ?? [],
    somedayWork: sectionByKey.get('next')?.files ?? [],
    activePlans: sectionByKey.get('plans.active')?.files ?? [],
    completedPlans: sectionByKey.get('plans.completed')?.files ?? [],
    runsMarkdown: sectionByKey.get('runs')?.markdown ?? '',
    outputsMarkdown: sectionByKey.get('outputs')?.markdown ?? '',
    reviews,
    reviewDocuments,
    planMetadata: [],
    reviewGroups: groupReviewsByFolder(reviews),
    semanticSections,
    projects: deriveProjects(sectionByKey.get('projects')),
    taskGroups: [
      deriveTaskGroup('current', sectionByKey.get('current')),
      deriveTaskGroup('next', sectionByKey.get('next')),
      deriveTaskGroup('done', sectionByKey.get('done')),
    ].filter((group): group is WorkbenchTaskGroup => Boolean(group)),
    tailActions,
  };
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
  if (!workItemPath || !workItemPath.startsWith('work/') || actionIndex === null || !status) return false;

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
  if (!workItemPath || !workItemPath.startsWith('work/active/')) return { archived: false };

  const repository = getWorkbenchMoveApi();
  const markdown = await repository.readText(binding.repoPath, workItemPath);
  if (!isWorkbenchMatterDone(markdown)) return { archived: false };

  const archivedPath = workItemPath.replace(/^work\/active\//, 'work/completed/');
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
  if (!workItemPath || !workItemPath.startsWith('work/') || actionIndex === null) return false;

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
  if (!workItemPath || !workItemPath.startsWith('work/')) return false;

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
  if (!workItemPath || !workItemPath.startsWith('work/')) {
    throw new Error('Review draft source must be a work item markdown path');
  }

  const createdAt = input.createdAt ?? new Date();
  const date = createdAt.toISOString().slice(0, 10);
  const tailActionIndex = input.tailActionId ? parseTailActionIndex(input.tailActionId) : null;
  const workSlug = slugifyPathSegment(workItemPath.replace(/\.md$/i, '').split('/').pop() ?? 'work-item');
  const tailSlug = tailActionIndex === null ? 'tail-action' : `tail-action-${tailActionIndex}`;
  const path = `reviews/weekly/${date}-work-${workSlug}-${tailSlug}-review.md`;
  const content = buildWorkbenchReviewDraftMarkdown({
    workItemPath,
    tailActionId: input.tailActionId,
    createdAt,
  });

  await getWorkbenchReviewWriteApi().writeText(binding.repoPath, path, content);
  return { path, content };
}

export async function confirmWorkbenchReviewDraft(
  binding: RepositoryBinding,
  input: WorkbenchReviewConfirmInput,
): Promise<boolean> {
  const reviewPath = normalizeWritableWorkbenchMarkdownPath(input.reviewPath);
  const workItemPath = normalizeWritableWorkbenchMarkdownPath(input.workItemPath);
  const tailActionIndex = parseTailActionIndex(input.tailActionId);
  if (!reviewPath || !reviewPath.startsWith('reviews/') || !workItemPath || !workItemPath.startsWith('work/')) {
    return false;
  }
  if (tailActionIndex === null) return false;

  const repository = getWorkbenchWriteApi();
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

export function parsePlanMetadata(path: string, markdown: string): RepositoryPlanMetadata {
  const metadata: RepositoryPlanMetadata = { path };
  for (const line of markdown.split('\n').slice(0, 24)) {
    const match = /^([^:：]+)[：:]\s*(.+)$/.exec(line.trim());
    if (!match) continue;
    const key = normalizePlanMetadataKey(match[1]);
    const value = match[2].trim();
    if (key === 'status') metadata.status = value;
    if (key === 'approval') metadata.approval = value;
    if (key === 'blockedreason') metadata.blockedReason = value;
    if (key === 'blockerowner') metadata.blockerOwner = value;
    if (key === 'workitempath') metadata.workItemPath = value;
    if (key === 'dependencies') {
      metadata.dependencies = [...(metadata.dependencies ?? []), ...parseDependencyReferences(value)];
    }
  }
  return metadata;
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

function parseDependencyReferences(value: string): string[] {
  return value
    .split(/[,，;；]/)
    .map((part) => extractMarkdownLinkHref(part) ?? part)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractMarkdownLinkHref(value: string): string | undefined {
  return /\[[^\]]+]\(([^)]+)\)/.exec(value)?.[1]?.trim();
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function buildWorkbenchReviewDraftMarkdown(input: {
  workItemPath: string;
  tailActionId?: string;
  createdAt: Date;
}): string {
  return [
    '---',
    'source: desktop-workbench-review-tail-action',
    `workItemPath: ${input.workItemPath}`,
    input.tailActionId ? `tailActionId: ${input.tailActionId}` : undefined,
    `createdAt: ${input.createdAt.toISOString()}`,
    'status: draft',
    '---',
    '',
    `# ${input.workItemPath.split('/').pop()?.replace(/\.md$/i, '') ?? '工作事项'} 复盘草稿`,
    '',
    `来源事项: \`${input.workItemPath}\``,
    input.tailActionId ? `来源尾动作: \`${input.tailActionId}\`` : undefined,
    '',
    '## 核对清单',
    '',
    '- [ ] 核对来源事项目标、验收标准和当前状态。',
    '- [ ] 核对关联执行记录、运行摘要和错误信息。',
    '- [ ] 核对已经沉淀的成果、产物或 Repository output。',
    '- [ ] 判断是否需要更新知识库、计划或后续事项。',
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

function getWorkbenchReviewWriteApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.writeText) {
    throw new Error('electronAPI.repository workbench review write method not available');
  }
  return {
    writeText: repository.writeText,
  };
}
