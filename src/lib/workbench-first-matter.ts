import type { RepositoryBinding } from './agentic-repository';

export interface FirstWorkbenchMatter {
  id: string;
  path: string;
  title: string;
  markdown: string;
}

export interface FirstWorkbenchMatterInput {
  title: string;
  now?: Date;
  source?: string;
  workRoot?: string;
  carryover?: FirstWorkbenchMatterCarryover;
  linkedSources?: FirstWorkbenchMatterSourceRef[];
}

export interface CreateFirstWorkbenchMatterOptions {
  now?: Date;
  source?: string;
  carryover?: FirstWorkbenchMatterCarryover;
  linkedSources?: FirstWorkbenchMatterSourceRef[];
}

export interface FirstWorkbenchMatterCarryover {
  heading?: string;
  note?: string;
  checklist?: string[];
}

export interface FirstWorkbenchMatterSourceRef {
  title: string;
  path: string;
}

export function buildFirstWorkbenchMatter(input: FirstWorkbenchMatterInput): FirstWorkbenchMatter {
  const title = normalizeTitle(input.title);
  const now = input.now ?? new Date();
  const slug = slugifyTitle(title);
  const timestamp = now.toISOString().replace(/[-:.]/g, '');
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const id = `work-${timestamp}-${slug}`;
  const workRoot = normalizeWorkRoot(input.workRoot ?? 'work');
  const path = `${workRoot}/active/${date}-${time}-${slug}.md`;
  const carryoverSection = buildCarryoverSection(input.carryover);
  const linkedSources = normalizeLinkedSources(input.linkedSources);
  const markdown = [
    '---',
    `id: ${id}`,
    `title: ${JSON.stringify(title)}`,
    'status: active',
    `createdAt: ${now.toISOString()}`,
    `source: ${normalizeSource(input.source ?? 'desktop-onboarding')}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## 目标',
    '',
    title,
    '',
    '## 验收标准',
    '',
    '- [ ] 明确完成标准。',
    '',
    ...carryoverSection,
    '## 关联资料',
    '',
    ...(linkedSources.length
      ? linkedSources.map(
          (sourceRef) =>
            `- [${escapeMarkdownLinkText(sourceRef.title)}](${relativeMarkdownLink(path, sourceRef.path)})`,
        )
      : ['- 暂无']),
    '',
    '## 关联计划',
    '',
    '- 暂无',
    '',
    '## 执行记录',
    '',
    '- 暂无',
    '',
    '## 关联成果',
    '',
    '- 暂无',
    '',
    '## 复盘',
    '',
    '- 暂无',
    '',
  ].join('\n');

  return { id, path, title, markdown };
}

export async function createFirstWorkbenchMatter(
  binding: RepositoryBinding,
  title: string,
  options: CreateFirstWorkbenchMatterOptions = {},
): Promise<FirstWorkbenchMatter> {
  const writeText = typeof window !== 'undefined' ? window.electronAPI?.repository?.writeText : undefined;
  if (!writeText) throw new Error('Repository write API unavailable');

  const matter = buildFirstWorkbenchMatter({
    title,
    now: options.now,
    source: options.source,
    workRoot: binding.paths.work,
    carryover: options.carryover,
    linkedSources: options.linkedSources,
  });
  await writeText(binding.repoPath, matter.path, matter.markdown);
  return matter;
}

function normalizeLinkedSources(value: FirstWorkbenchMatterSourceRef[] | undefined): FirstWorkbenchMatterSourceRef[] {
  return (value ?? [])
    .map((sourceRef) => ({
      title: sourceRef.title.replace(/\s+/g, ' ').trim().slice(0, 120),
      path: normalizeLinkedSourcePath(sourceRef.path),
    }))
    .filter((sourceRef): sourceRef is FirstWorkbenchMatterSourceRef => Boolean(sourceRef.title && sourceRef.path))
    .slice(0, 8);
}

function normalizeLinkedSourcePath(value: string): string {
  const path = value.trim();
  if (!path || path.startsWith('/') || path.includes('\\') || !path.endsWith('.md')) return '';
  if (path.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return '';
  return path;
}

function relativeMarkdownLink(fromPath: string, toPath: string): string {
  const from = fromPath.split('/').slice(0, -1);
  const to = toPath.split('/');
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) common += 1;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].join('/');
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/[[\]]/g, '');
}

function buildCarryoverSection(carryover: FirstWorkbenchMatterCarryover | undefined): string[] {
  if (!carryover) return [];
  const heading = normalizeCarryoverLine(carryover.heading || '临时会话承接');
  const note = formatCarryoverNote(carryover.note);
  const checklist = (carryover.checklist ?? []).map(normalizeCarryoverLine).filter(Boolean).slice(0, 8);

  if (!note.length && checklist.length === 0) return [];

  return [
    `## ${heading}`,
    '',
    ...note,
    ...(note.length ? [''] : []),
    ...(checklist.length ? checklist.map((item) => `- [ ] ${item}`) : ['- [ ] 回看临时会话中的资料、结论和待办。']),
    '',
  ];
}

function formatCarryoverNote(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => `> ${line.slice(0, 240)}`);
}

function normalizeCarryoverLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normalizeTitle(value: string): string {
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title) throw new Error('First matter title is required');
  return title.slice(0, 160);
}

function slugifyTitle(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || 'first-thing';
}

function normalizeWorkRoot(value: string): string {
  const root = value.trim().replace(/\/+$/g, '');
  if (
    !root ||
    root.startsWith('/') ||
    root.includes('\\') ||
    root.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('Unsafe work root');
  }
  return root;
}

function normalizeSource(value: string): string {
  const source = value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return source || 'desktop-onboarding';
}
