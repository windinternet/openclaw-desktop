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
  sourceType?: 'sources' | 'wiki';
}

export interface KnowledgeSnapshot {
  sources: RepositoryMarkdownFile[];
  wiki: RepositoryMarkdownFile[];
  indexMarkdown: string;
  logMarkdown: string;
  recentFiles: RepositoryMarkdownFile[];
  backlinks: RepositoryBacklink[];
  relatedRepositoryLinks: RepositoryRelatedLink[];
}

export interface RepositoryBacklink {
  sourcePath: string;
  targetPath: string;
}

export interface RepositoryRelatedLink {
  sourcePath: string;
  targetPath: string;
  type: 'work' | 'output';
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
  const wikiContents = await Promise.all(
    wiki.map(async (file) => ({
      path: file.path,
      content: await repository.readText(binding.repoPath, file.path),
    })),
  );
  const wikiPaths = new Set(wiki.map((file) => file.path));
  const backlinks: RepositoryBacklink[] = [];
  const relatedRepositoryLinks: RepositoryRelatedLink[] = [];

  for (const file of wikiContents) {
    for (const href of extractMarkdownLinks(file.content)) {
      const targetPath = normalizeRepositoryLink(file.path, href);
      if (!targetPath) continue;
      if (targetPath.startsWith(`${binding.paths.wiki}/`) && wikiPaths.has(targetPath)) {
        backlinks.push({ sourcePath: file.path, targetPath });
      } else if (targetPath.startsWith(`${binding.paths.work}/`)) {
        relatedRepositoryLinks.push({ sourcePath: file.path, targetPath, type: 'work' });
      } else if (targetPath.startsWith(`${binding.paths.outputs}/`)) {
        relatedRepositoryLinks.push({ sourcePath: file.path, targetPath, type: 'output' });
      }
    }
  }

  return {
    sources,
    wiki,
    indexMarkdown,
    logMarkdown,
    recentFiles: [...sources, ...wiki].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12),
    backlinks,
    relatedRepositoryLinks,
  };
}

export async function searchKnowledge(
  binding: RepositoryBinding,
  query: string,
): Promise<RepositorySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const results = await getKnowledgeSearchApi().search(binding.repoPath, trimmed, [binding.paths.sources, binding.paths.wiki]);
  return results.map((result) => classifyKnowledgeSearchResult(binding, result));
}

export function classifyKnowledgeSearchResult(
  binding: RepositoryBinding,
  result: RepositorySearchResult,
): RepositorySearchResult {
  if (result.path.startsWith(`${binding.paths.sources}/`) || result.path === binding.paths.sources) {
    return { ...result, sourceType: 'sources' };
  }
  if (result.path.startsWith(`${binding.paths.wiki}/`) || result.path === binding.paths.wiki) {
    return { ...result, sourceType: 'wiki' };
  }
  return result;
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

export function normalizeRepositoryLink(sourcePath: string, href: string): string | null {
  const withoutAnchor = href.split('#')[0]?.trim();
  if (!withoutAnchor) return null;
  if (/^(https?:|mailto:)/i.test(withoutAnchor)) return null;
  const cleaned = withoutAnchor.replace(/^\/+/, '');
  if (/^(sources|wiki|work|plans|runs|outputs|reviews)\//.test(cleaned)) {
    return normalizePathSegments(cleaned);
  }
  const sourceDirectory = sourcePath.split('/').slice(0, -1).join('/');
  return normalizePathSegments(`${sourceDirectory}/${cleaned}`);
}

function normalizePathSegments(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
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
