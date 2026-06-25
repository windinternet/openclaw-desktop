import type { KnowledgeRepositoryMapping, RepositoryBinding } from './agentic-repository';

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
  indexEntries: KnowledgeIndexEntry[];
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
  const backlinks: RepositoryBacklink[] = [];
  const relatedRepositoryLinks: RepositoryRelatedLink[] = [];

  for (const file of wikiContents) {
    for (const href of extractMarkdownLinks(file.content)) {
      const targetPath = normalizeKnowledgeLink(binding, file.path, href);
      if (!targetPath) continue;
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
    indexEntries: parseKnowledgeIndexEntries({
      binding,
      indexPath: mapping.indexPath,
      markdown: indexMarkdown,
    }),
    indexMarkdown,
    logMarkdown,
    recentFiles: [...sources, ...wiki].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12),
    backlinks,
    relatedRepositoryLinks,
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

export function buildKnowledgeRewritePrompt(options: {
  binding: RepositoryBinding;
  intent: 'digest-source' | 'refresh-index' | 'update-selected';
  sourcePath?: string;
  selectedPath?: string;
  userInstruction?: string;
}): string {
  const { binding } = options;
  const selected = options.selectedPath || options.sourcePath;
  const focus = selected ? `当前选中的知识库文件：${selected}` : '当前没有选中文件，请先根据索引和最近资料判断更新对象。';
  const instruction = options.userInstruction?.trim() || (
    options.intent === 'digest-source'
      ? '把选中的资料源消化为可复用 Wiki 条目。'
      : options.intent === 'update-selected'
        ? '改写或补全选中的 Wiki 条目，并同步索引与日志。'
        : '巡检并刷新知识库索引与维护日志。'
  );

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
  return [
    '你是 OpenClaw Desktop 的知识库绑定助手。请基于 Karpathy LLM Wiki 思想，对用户选择的仓库做一次语义识别。',
    '',
    '判断标准不是固定目录名，而是仓库是否存在：',
    '- raw sources：原始资料/事实源，默认只读不改写。',
    '- wiki：LLM/Agent 维护的 Markdown 知识层。',
    '- index：知识导航入口。',
    '- log：追加式维护日志。',
    '- schema/rules：AGENTS.md、README 或类似 Agent 维护规则。',
    '',
    '只输出知识库 mapping，不要输出 work/plans/runs/outputs；工作台映射是独立流程。',
    '',
    `仓库路径：${options.repoPath}`,
    '',
    '目录树采样：',
    options.tree.map((item) => `- ${item}`).join('\n') || '- （空）',
    '',
    '文件摘录：',
    options.excerpts.map((item) => [
      `--- ${item.path} ---`,
      item.content.slice(0, 4000),
    ].join('\n')).join('\n\n') || '（无）',
    '',
    '请严格输出 ai-action JSON：',
    '```ai-action',
    '{"version":1,"kind":"completed","summary":"已识别知识库映射","result":{"isKnowledgeRepository":true,"confidence":"low|medium|high","mapping":{"sourceRoot":"...","wikiRoot":"...","indexPath":"...","logPath":"...","schemaPath":"...","mapsRoot":"..."}}}',
    '```',
    '',
    '如果不符合 LLM Wiki 思维，请设置 isKnowledgeRepository=false，并说明原因。',
  ].join('\n');
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

export async function searchKnowledge(
  binding: RepositoryBinding,
  query: string,
): Promise<RepositorySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const results = await getKnowledgeSearchApi().search(binding.repoPath, trimmed, [binding.knowledge.sourceRoot, binding.knowledge.wikiRoot]);
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

function cleanMarkdownCell(cell: string): string {
  return cell
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.match(/^\[([^\]]+)\]/)?.[1] ?? '')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function normalizeMappingResult(value: Record<string, unknown>, confidence?: 'low' | 'medium' | 'high'): KnowledgeRepositoryMapping | null {
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
