import type { RepositoryBinding } from './agentic-repository';

export interface RepositoryMarkdownFile {
  path: string;
  name: string;
  size: number;
  updatedAt: number;
}

export interface RepositorySearchResult {
  path: string;
  line: number;
  snippet: string;
}

export interface KnowledgeSnapshot {
  sources: RepositoryMarkdownFile[];
  wiki: RepositoryMarkdownFile[];
  indexMarkdown: string;
  logMarkdown: string;
}

interface KnowledgeReadApi {
  listMarkdown: (repoPath: string, directory: string) => Promise<RepositoryMarkdownFile[]>;
  readText: (repoPath: string, relativePath: string) => Promise<string>;
}

interface KnowledgeSearchApi {
  search: (repoPath: string, query: string, directories: string[]) => Promise<RepositorySearchResult[]>;
}

export async function loadKnowledgeSnapshot(binding: RepositoryBinding): Promise<KnowledgeSnapshot> {
  const repository = getKnowledgeReadApi();
  const [sources, wiki, indexMarkdown, logMarkdown] = await Promise.all([
    repository.listMarkdown(binding.repoPath, binding.paths.sources),
    repository.listMarkdown(binding.repoPath, binding.paths.wiki),
    repository.readText(binding.repoPath, `${binding.paths.wiki}/index.md`),
    repository.readText(binding.repoPath, `${binding.paths.wiki}/log.md`),
  ]);

  return {
    sources,
    wiki,
    indexMarkdown,
    logMarkdown,
  };
}

export async function searchKnowledge(
  binding: RepositoryBinding,
  query: string,
): Promise<RepositorySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return getKnowledgeSearchApi().search(binding.repoPath, trimmed, [binding.paths.sources, binding.paths.wiki]);
}

export function extractMarkdownLinks(markdown: string): string[] {
  const links: string[] = [];
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown))) {
    const href = match[1]?.trim();
    if (!href || /^(https?:|mailto:|#)/i.test(href)) continue;
    links.push(href);
  }
  return links;
}

export function findBacklinks(
  files: Array<{ path: string; content: string }>,
  targetPath: string,
): string[] {
  return files
    .filter((file) => extractMarkdownLinks(file.content).includes(targetPath))
    .map((file) => file.path);
}

function getKnowledgeReadApi(): KnowledgeReadApi {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.listMarkdown || !repository.readText) {
    throw new Error('electronAPI.repository knowledge methods not available');
  }
  return {
    listMarkdown: repository.listMarkdown,
    readText: repository.readText,
  };
}

function getKnowledgeSearchApi(): KnowledgeSearchApi {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.search) {
    throw new Error('electronAPI.repository search method not available');
  }
  return {
    search: repository.search,
  };
}
