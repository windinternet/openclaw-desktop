import type { RepositoryBinding, SemanticSlot } from './agentic-repository';
import type { RepositoryMarkdownFile } from './repository-knowledge';

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
    runsMarkdown,
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
    repository.readText(binding.repoPath, `${binding.paths.outputs}/index.md`),
    repository.listMarkdown(binding.repoPath, binding.paths.reviews),
  ]);

  const [planMetadata, tailActions] = await Promise.all([
    Promise.all(
      [...activePlans, ...completedPlans].map(async (file) =>
        parsePlanMetadata(file.path, await repository.readText(binding.repoPath, file.path)),
      ),
    ),
    loadWorkbenchTailActions(binding, [...activeWork, ...completedWork, ...somedayWork]),
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
    planMetadata: planMetadata.filter((item) => item.status || item.approval),
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
  const reviews = semanticSections.find((section) => section.key === 'reviews')?.files ?? [];
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

export function parsePlanMetadata(path: string, markdown: string): RepositoryPlanMetadata {
  const metadata: RepositoryPlanMetadata = { path };
  for (const line of markdown.split('\n').slice(0, 24)) {
    const match = /^([A-Za-z][\w-]*):\s*(.+)$/.exec(line.trim());
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'status') metadata.status = value;
    if (key === 'approval') metadata.approval = value;
  }
  return metadata;
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

function parseTailActionIndex(id: string): number | null {
  const match = /:tail-action:(\d+)$/.exec(id);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function normalizeWritableWorkbenchMarkdownPath(value: string): string | null {
  const path = value.trim().replace(/^\/+/, '');
  const segments = path.split('/');
  if (!path.endsWith('.md') || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }
  return path;
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
