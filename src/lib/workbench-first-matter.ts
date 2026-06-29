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
}

export interface CreateFirstWorkbenchMatterOptions {
  now?: Date;
  source?: string;
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
    '## 关联资料',
    '',
    '- 暂无',
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
  });
  await writeText(binding.repoPath, matter.path, matter.markdown);
  return matter;
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
  const root = value.trim().replace(/^\/+|\/+$/g, '');
  if (!root || root.includes('..')) throw new Error('Unsafe work root');
  return root;
}

function normalizeSource(value: string): string {
  const source = value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return source || 'desktop-onboarding';
}
