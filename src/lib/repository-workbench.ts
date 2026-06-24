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
  };
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
