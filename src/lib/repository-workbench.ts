import type { RepositoryBinding } from './agentic-repository';
import type { RepositoryMarkdownFile } from './repository-knowledge';

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

  const planMetadata = await Promise.all(
    [...activePlans, ...completedPlans].map(async (file) => (
      parsePlanMetadata(file.path, await repository.readText(binding.repoPath, file.path))
    )),
  );

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
  };
}

export async function readWorkbenchMarkdown(binding: RepositoryBinding, relativePath: string): Promise<string> {
  return getWorkbenchTextApi().readText(binding.repoPath, relativePath);
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
