import knowledgeSemanticMappingTemplate from '../prompts/repository/knowledge-semantic-mapping.md?raw';
import type { KnowledgeRepositoryMapping, RepositoryBinding } from './agentic-repository';
import { renderPromptTemplate } from './prompt-template';

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

export interface KnowledgeIndexEntry {
  title: string;
  path: string;
  kind: 'source' | 'wiki';
  summary: string;
}

export interface KnowledgeDocument {
  path: string;
  title: string;
  content: string;
  sourceType?: 'sources' | 'wiki';
}

export interface RepositoryGitLogEntry {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
}

export interface KnowledgeSnapshot {
  sources: RepositoryMarkdownFile[];
  wiki: RepositoryMarkdownFile[];
  undigestedSources: RepositoryMarkdownFile[];
  indexEntries: KnowledgeIndexEntry[];
  indexMarkdown: string;
  logMarkdown: string;
  recentFiles: RepositoryMarkdownFile[];
  backlinks: RepositoryBacklink[];
  relatedRepositoryLinks: RepositoryRelatedLink[];
  health: KnowledgeHealthReport;
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

export type KnowledgeHealthIssueKind =
  | 'orphan_source'
  | 'unindexed_wiki'
  | 'stale_index_entry'
  | 'broken_knowledge_link'
  | 'wiki_without_source_reference';

export interface KnowledgeHealthIssue {
  id: string;
  kind: KnowledgeHealthIssueKind;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  path: string;
  targetPath?: string;
  updatedAt?: number;
}

export interface KnowledgeHealthReport {
  issues: KnowledgeHealthIssue[];
  counts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export interface KnowledgeRepositoryMappingResponse {
  isKnowledgeRepository: boolean;
  confidence?: 'low' | 'medium' | 'high';
  reason?: string;
  mapping?: KnowledgeRepositoryMapping;
}

interface KnowledgeReadApi {
  listMarkdown: (repoPath: string, directory: string) => Promise<RepositoryMarkdownFile[]>;
  readText: (repoPath: string, relativePath: string) => Promise<string>;
}

interface KnowledgeTextApi {
  readText: (repoPath: string, relativePath: string) => Promise<string>;
}

interface KnowledgeWriteApi {
  writeText: (repoPath: string, relativePath: string, content: string) => Promise<void>;
}

interface KnowledgeSearchApi {
  search: (repoPath: string, query: string, directories: string[]) => Promise<RepositorySearchResult[]>;
}

interface KnowledgeGitApi {
  gitLog?: (repoPath: string, relativePath: string, limit?: number) => Promise<RepositoryGitLogEntry[]>;
}

export async function loadKnowledgeSnapshot(binding: RepositoryBinding): Promise<KnowledgeSnapshot> {
  const repository = getKnowledgeReadApi();
  const mapping = binding.knowledge;
  const [sources, rawWiki, indexMarkdown, logMarkdown] = await Promise.all([
    repository.listMarkdown(binding.repoPath, mapping.sourceRoot),
    repository.listMarkdown(binding.repoPath, mapping.wikiRoot),
    repository.readText(binding.repoPath, mapping.indexPath),
    repository.readText(binding.repoPath, mapping.logPath),
  ]);
  const wiki = rawWiki.filter((file) => !isNestedKnowledgeSource(binding, file.path));
  const wikiContents = await Promise.all(
    wiki.map(async (file) => ({
      path: file.path,
      content: await repository.readText(binding.repoPath, file.path),
    })),
  );
  const wikiPaths = new Set(wiki.map((file) => file.path));
  const sourcePaths = new Set(sources.map((file) => file.path));
  const knowledgePaths = new Set([...sourcePaths, ...wikiPaths]);
  const indexEntries = parseKnowledgeIndexEntries({
    binding,
    indexPath: mapping.indexPath,
    markdown: indexMarkdown,
  });
  const indexedKnowledgePaths = new Set(indexEntries.map((entry) => entry.path));
  const backlinks: RepositoryBacklink[] = [];
  const relatedRepositoryLinks: RepositoryRelatedLink[] = [];
  const linkedKnowledgePaths = new Set<string>();
  const brokenKnowledgeLinks: KnowledgeHealthIssue[] = [];

  for (const file of wikiContents) {
    for (const href of extractMarkdownLinks(file.content)) {
      const targetPath = normalizeKnowledgeLink(binding, file.path, href);
      if (!targetPath) continue;
      if (isKnowledgePath(binding, targetPath)) {
        if (knowledgePaths.has(targetPath)) {
          linkedKnowledgePaths.add(targetPath);
        } else {
          brokenKnowledgeLinks.push({
            id: `broken-link:${file.path}->${targetPath}`,
            kind: 'broken_knowledge_link',
            severity: 'warning',
            title: '知识库断链',
            detail: `Wiki 链接指向不存在的知识文件：${targetPath}`,
            path: file.path,
            targetPath,
            updatedAt: wiki.find((item) => item.path === file.path)?.updatedAt,
          });
        }
      }
      if (targetPath.startsWith(`${mapping.wikiRoot}/`) && wikiPaths.has(targetPath)) {
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
    undigestedSources: sources
      .filter((source) => !indexedKnowledgePaths.has(source.path) && !linkedKnowledgePaths.has(source.path))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    indexEntries,
    indexMarkdown,
    logMarkdown,
    recentFiles: [...sources, ...wiki].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12),
    backlinks,
    relatedRepositoryLinks,
    health: buildKnowledgeHealthReport({
      binding,
      sources,
      wiki,
      wikiContents,
      indexEntries,
      linkedKnowledgePaths,
      brokenKnowledgeLinks,
    }),
  };
}

export async function readKnowledgeDocument(
  binding: RepositoryBinding,
  relativePath: string,
): Promise<KnowledgeDocument> {
  const content = await getKnowledgeTextApi().readText(binding.repoPath, relativePath);
  return {
    path: relativePath,
    title: extractMarkdownTitle(content) || relativePath.split('/').pop() || relativePath,
    content,
    sourceType: classifyKnowledgePath(binding, relativePath),
  };
}

export interface KnowledgeTextSourceImportInput {
  title?: string;
  body: string;
  now?: Date;
  sourceRoot?: string;
}

export interface KnowledgeTextSourceImport {
  title: string;
  path: string;
  markdown: string;
}

export interface KnowledgeUrlSourceImportInput {
  title?: string;
  url: string;
  note?: string;
  now?: Date;
  sourceRoot?: string;
}

export function buildKnowledgeTextSourceImport(input: KnowledgeTextSourceImportInput): KnowledgeTextSourceImport {
  const body = normalizeSourceBody(input.body);
  const title = normalizeSourceTitle(input.title, body);
  const now = input.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const sourceRoot = normalizeSourceRoot(input.sourceRoot ?? 'sources');
  const path = `${sourceRoot}/imported/${date}-${time}-${slugifyKnowledgeTitle(title)}.md`;
  const markdown = [
    '---',
    `title: ${JSON.stringify(title)}`,
    'source: desktop-paste',
    `importedAt: ${now.toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## 原始内容',
    '',
    body,
    '',
  ].join('\n');

  return { title, path, markdown };
}

export function buildKnowledgeUrlSourceImport(input: KnowledgeUrlSourceImportInput): KnowledgeTextSourceImport {
  const url = normalizeSourceUrl(input.url);
  const note = input.note?.replace(/\r\n/g, '\n').trim();
  const title = normalizeSourceTitle(input.title, `${url.hostname}${url.pathname}`);
  const now = input.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const sourceRoot = normalizeSourceRoot(input.sourceRoot ?? 'sources');
  const href = url.toString();
  const path = `${sourceRoot}/imported/${date}-${time}-${slugifyKnowledgeTitle(title)}.md`;
  const markdown = [
    '---',
    `title: ${JSON.stringify(title)}`,
    'source: desktop-url',
    `url: ${JSON.stringify(href)}`,
    `importedAt: ${now.toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## 来源链接',
    '',
    `- ${href}`,
    '',
    '## 摘录与备注',
    '',
    note || '暂无',
    '',
  ].join('\n');

  return { title, path, markdown };
}

export async function importKnowledgeTextSource(
  binding: RepositoryBinding,
  input: Omit<KnowledgeTextSourceImportInput, 'sourceRoot'>,
): Promise<KnowledgeTextSourceImport> {
  const imported = buildKnowledgeTextSourceImport({
    ...input,
    sourceRoot: binding.knowledge.sourceRoot,
  });
  await getKnowledgeWriteApi().writeText(binding.repoPath, imported.path, imported.markdown);
  return imported;
}

export async function importKnowledgeUrlSource(
  binding: RepositoryBinding,
  input: Omit<KnowledgeUrlSourceImportInput, 'sourceRoot'>,
): Promise<KnowledgeTextSourceImport> {
  const imported = buildKnowledgeUrlSourceImport({
    ...input,
    sourceRoot: binding.knowledge.sourceRoot,
  });
  await getKnowledgeWriteApi().writeText(binding.repoPath, imported.path, imported.markdown);
  return imported;
}

export async function loadKnowledgeDocumentHistory(
  binding: RepositoryBinding,
  relativePath: string,
  limit = 8,
): Promise<RepositoryGitLogEntry[]> {
  const repository = getKnowledgeGitApi();
  if (!repository.gitLog) return [];
  try {
    return await repository.gitLog(binding.repoPath, relativePath, limit);
  } catch {
    return [];
  }
}

export function parseKnowledgeIndexEntries(options: {
  binding: RepositoryBinding;
  indexPath: string;
  markdown: string;
}): KnowledgeIndexEntry[] {
  const entries: KnowledgeIndexEntry[] = [];
  const seen = new Set<string>();

  for (const line of options.markdown.split(/\r?\n/)) {
    const links = Array.from(line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g));
    if (links.length === 0) continue;

    const cells = line.includes('|')
      ? line
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean)
      : [];
    if (cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;

    const summary = cells.length >= 2 ? cleanMarkdownCell(cells[1]) : '';
    for (const link of links) {
      const title = link[1]?.trim();
      const href = link[2]?.trim();
      if (!title || !href) continue;
      const path = normalizeKnowledgeLink(options.binding, options.indexPath, href);
      if (!path || seen.has(path)) continue;
      const kind = classifyKnowledgeEntryKind(options.binding, path);
      if (!kind) continue;
      seen.add(path);
      entries.push({
        title,
        path,
        kind,
        summary,
      });
    }
  }

  return entries;
}

function buildKnowledgeHealthReport(options: {
  binding: RepositoryBinding;
  sources: RepositoryMarkdownFile[];
  wiki: RepositoryMarkdownFile[];
  wikiContents: Array<{ path: string; content: string }>;
  indexEntries: KnowledgeIndexEntry[];
  linkedKnowledgePaths: Set<string>;
  brokenKnowledgeLinks: KnowledgeHealthIssue[];
}): KnowledgeHealthReport {
  const mapping = options.binding.knowledge;
  const sourcePaths = new Set(options.sources.map((file) => file.path));
  const wikiPaths = new Set(options.wiki.map((file) => file.path));
  const knowledgePaths = new Set([...sourcePaths, ...wikiPaths]);
  const indexedPaths = new Set(options.indexEntries.map((entry) => entry.path));
  const wikiFileByPath = new Map(options.wiki.map((file) => [file.path, file]));
  const issues: KnowledgeHealthIssue[] = [];

  for (const source of options.sources) {
    if (indexedPaths.has(source.path) || options.linkedKnowledgePaths.has(source.path)) continue;
    issues.push({
      id: `orphan-source:${source.path}`,
      kind: 'orphan_source',
      severity: 'warning',
      title: '孤立资料',
      detail: '资料还没有被索引或 Wiki 引用。',
      path: source.path,
      updatedAt: source.updatedAt,
    });
  }

  for (const wiki of options.wiki) {
    if (wiki.path === mapping.indexPath || wiki.path === mapping.logPath || indexedPaths.has(wiki.path)) continue;
    issues.push({
      id: `unindexed-wiki:${wiki.path}`,
      kind: 'unindexed_wiki',
      severity: 'warning',
      title: '未进入索引的 Wiki',
      detail: 'Wiki 页面还没有出现在知识索引中。',
      path: wiki.path,
      updatedAt: wiki.updatedAt,
    });
  }

  for (const entry of options.indexEntries) {
    if (knowledgePaths.has(entry.path)) continue;
    issues.push({
      id: `stale-index:${mapping.indexPath}->${entry.path}`,
      kind: 'stale_index_entry',
      severity: 'warning',
      title: '索引陈旧',
      detail: `知识索引指向不存在的文件：${entry.path}`,
      path: mapping.indexPath,
      targetPath: entry.path,
      updatedAt: wikiFileByPath.get(mapping.indexPath)?.updatedAt,
    });
  }

  issues.push(...dedupeKnowledgeHealthIssues(options.brokenKnowledgeLinks));

  for (const file of options.wikiContents) {
    if (file.path === mapping.indexPath || file.path === mapping.logPath) continue;
    const linksToSource = extractMarkdownLinks(file.content)
      .map((href) => normalizeKnowledgeLink(options.binding, file.path, href))
      .some((targetPath) => Boolean(targetPath && sourcePaths.has(targetPath)));
    if (linksToSource) continue;

    issues.push({
      id: `wiki-no-source:${file.path}`,
      kind: 'wiki_without_source_reference',
      severity: 'warning',
      title: 'Wiki 缺少来源引用',
      detail: 'Wiki 页面没有直接引用资料源，后续难以追溯事实来源。',
      path: file.path,
      updatedAt: wikiFileByPath.get(file.path)?.updatedAt,
    });
  }

  const sortedIssues = dedupeKnowledgeHealthIssues(issues).sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff !== 0) return severityDiff;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.id.localeCompare(b.id);
  });

  return {
    issues: sortedIssues,
    counts: {
      total: sortedIssues.length,
      critical: sortedIssues.filter((issue) => issue.severity === 'critical').length,
      warning: sortedIssues.filter((issue) => issue.severity === 'warning').length,
      info: sortedIssues.filter((issue) => issue.severity === 'info').length,
    },
  };
}

function dedupeKnowledgeHealthIssues(issues: KnowledgeHealthIssue[]): KnowledgeHealthIssue[] {
  const seen = new Set<string>();
  const result: KnowledgeHealthIssue[] = [];
  for (const issue of issues) {
    if (seen.has(issue.id)) continue;
    seen.add(issue.id);
    result.push(issue);
  }
  return result;
}

function severityRank(severity: KnowledgeHealthIssue['severity']): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

export function buildKnowledgeRewritePrompt(options: {
  binding: RepositoryBinding;
  intent: 'digest-source' | 'refresh-index' | 'update-selected';
  sourcePath?: string;
  selectedPath?: string;
  userInstruction?: string;
}): string {
  const { binding } = options;
  const selected = options.selectedPath || options.sourcePath;
  const focus = selected
    ? `当前选中的知识库文件：${selected}`
    : '当前没有选中文件，请先根据索引和最近资料判断更新对象。';
  const instruction =
    options.userInstruction?.trim() ||
    (options.intent === 'digest-source'
      ? '把选中的资料源消化为可复用 Wiki 条目。'
      : options.intent === 'update-selected'
        ? '改写或补全选中的 Wiki 条目，并同步索引与日志。'
        : '巡检并刷新知识库索引与维护日志。');

  return [
    '你是 OpenClaw Desktop 知识库自动改写助手，目标是维护绑定仓库中的 LLM Wiki。',
    '',
    '仓库上下文：',
    `- repoPath: ${binding.repoPath}`,
    `- sources: ${binding.knowledge.sourceRoot}`,
    `- wiki: ${binding.knowledge.wikiRoot}`,
    `- index: ${binding.knowledge.indexPath}`,
    `- log: ${binding.knowledge.logPath}`,
    focus,
    '',
    '用户意图：',
    instruction,
    '',
    '必须遵守：',
    '1. 先使用 desktop.repository.read / desktop.repository.search 读取资料源、现有 Wiki、index 和 log，不要臆造。',
    '2. sources/ 是事实源，默认不改写原始正文；可在 wiki/ 中沉淀可复用知识。',
    '3. 需要写入或改写任何仓库文件前，必须先输出 ```ai-action 的 approval_required，请列出将修改的路径和风险。',
    '4. 用户批准后，才可使用 desktop.repository.write 写入 Wiki 条目、更新 wiki/index.md，并向 wiki/log.md 追加维护记录。',
    '5. 完成后输出 ```ai-action 的 completed，summary 说明新增/更新的知识条目、索引和日志。',
    '',
    '结构化审批示例：',
    '```ai-action',
    '{"version":1,"kind":"approval_required","summary":"准备消化资料源并更新知识库","approval":{"title":"写入知识库 Wiki/index/log","risk":"medium","reason":"将通过 desktop.repository.write 修改 wiki 条目、wiki/index.md 和 wiki/log.md"}}',
    '```',
  ].join('\n');
}

export function buildKnowledgeRepositoryMappingPrompt(options: {
  repoPath: string;
  tree: string[];
  excerpts: Array<{ path: string; content: string }>;
}): string {
  return renderPromptTemplate(knowledgeSemanticMappingTemplate, {
    repoPath: options.repoPath,
    tree: options.tree.map((item) => `- ${item}`).join('\n') || '- （空）',
    excerpts:
      options.excerpts.map((item) => [`--- ${item.path} ---`, item.content.slice(0, 4000)].join('\n')).join('\n\n') ||
      '（无）',
  });
}

export function parseKnowledgeRepositoryMappingResponse(text: string): KnowledgeRepositoryMappingResponse | null {
  const blocks = Array.from(text.matchAll(/```ai-action\s*([\s\S]*?)```/gi));
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(blocks[index][1].trim());
      const result = isRecord(parsed.result) ? parsed.result : parsed;
      const isKnowledgeRepository = result.isKnowledgeRepository === true;
      const confidence = normalizeConfidence(result.confidence);
      if (!isKnowledgeRepository) {
        return {
          isKnowledgeRepository: false,
          confidence,
          reason: typeof result.reason === 'string' ? result.reason : undefined,
        };
      }
      if (!isRecord(result.mapping)) continue;
      const mapping = normalizeMappingResult(result.mapping, confidence);
      if (!mapping) continue;
      return {
        isKnowledgeRepository: true,
        confidence,
        mapping,
      };
    } catch {
      // Try older blocks.
    }
  }
  return null;
}

export async function searchKnowledge(binding: RepositoryBinding, query: string): Promise<RepositorySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const results = await getKnowledgeSearchApi().search(binding.repoPath, trimmed, [
    binding.knowledge.sourceRoot,
    binding.knowledge.wikiRoot,
  ]);
  return results.map((result) => classifyKnowledgeSearchResult(binding, result));
}

export function classifyKnowledgeSearchResult(
  binding: RepositoryBinding,
  result: RepositorySearchResult,
): RepositorySearchResult {
  if (result.path.startsWith(`${binding.knowledge.sourceRoot}/`) || result.path === binding.knowledge.sourceRoot) {
    return { ...result, sourceType: 'sources' };
  }
  if (result.path.startsWith(`${binding.knowledge.wikiRoot}/`) || result.path === binding.knowledge.wikiRoot) {
    return { ...result, sourceType: 'wiki' };
  }
  return result;
}

function classifyKnowledgePath(binding: RepositoryBinding, path: string): 'sources' | 'wiki' | undefined {
  if (path.startsWith(`${binding.knowledge.sourceRoot}/`) || path === binding.knowledge.sourceRoot) {
    return 'sources';
  }
  if (path.startsWith(`${binding.knowledge.wikiRoot}/`) || path === binding.knowledge.wikiRoot) {
    return 'wiki';
  }
  return undefined;
}

function isKnowledgePath(binding: RepositoryBinding, path: string): boolean {
  return Boolean(classifyKnowledgePath(binding, path));
}

function isNestedKnowledgeSource(binding: RepositoryBinding, path: string): boolean {
  return (
    binding.knowledge.sourceRoot.startsWith(`${binding.knowledge.wikiRoot}/`) &&
    path.startsWith(`${binding.knowledge.sourceRoot}/`)
  );
}

function classifyKnowledgeEntryKind(binding: RepositoryBinding, path: string): KnowledgeIndexEntry['kind'] | null {
  const sourceType = classifyKnowledgePath(binding, path);
  if (sourceType === 'sources') return 'source';
  if (sourceType === 'wiki') return 'wiki';
  return null;
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

export function findBacklinks(files: Array<{ path: string; content: string }>, targetPath: string): string[] {
  return files.filter((file) => extractMarkdownLinks(file.content).includes(targetPath)).map((file) => file.path);
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

function normalizeKnowledgeLink(binding: RepositoryBinding, sourcePath: string, href: string): string | null {
  const withoutAnchor = href.split('#')[0]?.trim();
  if (!withoutAnchor || /^(https?:|mailto:)/i.test(withoutAnchor)) return null;
  const cleaned = withoutAnchor.replace(/^\/+/, '');
  if (
    cleaned.startsWith(`${binding.knowledge.sourceRoot}/`) ||
    cleaned.startsWith(`${binding.knowledge.wikiRoot}/`) ||
    cleaned === binding.knowledge.sourceRoot ||
    cleaned === binding.knowledge.wikiRoot
  ) {
    return normalizePathSegments(cleaned);
  }
  return normalizeRepositoryLink(sourcePath, href);
}

function extractMarkdownTitle(content: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

function normalizeSourceBody(value: string): string {
  const body = value.replace(/\r\n/g, '\n').trim();
  if (!body) throw new Error('Knowledge source body is required');
  return body;
}

function normalizeSourceTitle(title: string | undefined, body: string): string {
  const explicit = title?.replace(/\s+/g, ' ').trim();
  const firstLine = body
    .split('\n')
    .map((line) =>
      line
        .replace(/^#+\s*/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .find(Boolean);
  return (explicit || firstLine || '粘贴资料').slice(0, 160);
}

function slugifyKnowledgeTitle(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || 'pasted-source';
}

function normalizeSourceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Knowledge source URL is invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Knowledge source URL must use http or https');
  }
  return url;
}

function normalizeSourceRoot(value: string): string {
  const root = value.trim().replace(/^\/+|\/+$/g, '');
  if (!root || root.includes('..')) throw new Error('Unsafe knowledge source root');
  return root;
}

function cleanMarkdownCell(cell: string): string {
  return cell
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.match(/^\[([^\]]+)\]/)?.[1] ?? '')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function normalizeMappingResult(
  value: Record<string, unknown>,
  confidence?: 'low' | 'medium' | 'high',
): KnowledgeRepositoryMapping | null {
  const sourceRoot = stringValue(value.sourceRoot);
  const wikiRoot = stringValue(value.wikiRoot);
  const indexPath = stringValue(value.indexPath);
  const logPath = stringValue(value.logPath);
  if (!sourceRoot || !wikiRoot || !indexPath || !logPath) return null;
  return {
    sourceRoot,
    wikiRoot,
    indexPath,
    logPath,
    schemaPath: stringValue(value.schemaPath),
    mapsRoot: stringValue(value.mapsRoot),
    assetsRoot: stringValue(value.assetsRoot),
    confidence,
    mappingSource: 'agent',
  };
}

function normalizeConfidence(value: unknown): 'low' | 'medium' | 'high' | undefined {
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function getKnowledgeTextApi(): KnowledgeTextApi {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.readText) {
    throw new Error('electronAPI.repository knowledge text method not available');
  }
  return {
    readText: repository.readText,
  };
}

function getKnowledgeWriteApi(): KnowledgeWriteApi {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.writeText) {
    throw new Error('electronAPI.repository knowledge write method not available');
  }
  return {
    writeText: repository.writeText,
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

function getKnowledgeGitApi(): KnowledgeGitApi {
  return (globalThis as { window?: Window }).window?.electronAPI?.repository ?? {};
}
