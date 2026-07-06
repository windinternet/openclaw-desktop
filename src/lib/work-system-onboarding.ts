import type { FirstWorkbenchMatterCarryover } from './workbench-first-matter';
import type { RepositoryBinding } from './agentic-repository';
import { extractSessionMessageItems } from './session-content';

export const WORK_SYSTEM_ONBOARDING_ROUTE = '/?onboarding=work-system';
export const WORK_SYSTEM_ONBOARDING_ANCHOR = 'work-system-onboarding';
export const WORK_SYSTEM_ONBOARDING_STATE_SOURCE = 'work-system-onboarding-skip';

export interface WorkSystemOnboardingSessionState {
  source: typeof WORK_SYSTEM_ONBOARDING_STATE_SOURCE;
  initialMessage: string;
  starterLabel: string;
  firstThingTitle: string;
}

export interface TemporarySessionCarryoverMessage {
  role?: string;
  content?: unknown;
}

interface TemporarySessionClues {
  outputs: string[];
  knowledge: string[];
  reviews: string[];
}

export interface TemporarySessionSourceArchive {
  title: string;
  path: string;
  markdown: string;
}

export interface TemporarySessionSourceArchiveOptions {
  now?: Date;
  sourceRoot?: string;
  sessionKey?: string;
}

export interface SkippedWorkspaceSessionHistoryClient {
  request(method: string, params?: unknown): Promise<unknown>;
}

export function isWorkSystemOnboardingSearch(search: string): boolean {
  return new URLSearchParams(search).get('onboarding') === 'work-system';
}

export function buildSkippedWorkspaceSessionMessage(firstThing: string): string {
  const title = firstThing.trim();
  if (!title) {
    return [
      '我想先体验 OpenClaw Desktop，不先配置工作空间。',
      '请用轻量方式帮我开始；如果过程中产生需要长期沉淀的资料、知识、事项、计划、执行记录、成果或复盘，请提醒我稍后绑定或创建工作空间。',
    ].join('\n\n');
  }

  return [
    '我想先体验 OpenClaw Desktop，不先配置工作空间。',
    `请把这件事当作临时事项帮我推进：${title}`,
    '如果过程中产生需要长期沉淀的资料、知识、事项、计划、执行记录、成果或复盘，请提醒我稍后绑定或创建工作空间。',
  ].join('\n\n');
}

export function buildSkippedWorkspaceSessionState(
  firstThing: string,
  starterLabel: string,
): WorkSystemOnboardingSessionState {
  const firstThingTitle = firstThing.replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    source: WORK_SYSTEM_ONBOARDING_STATE_SOURCE,
    initialMessage: buildSkippedWorkspaceSessionMessage(firstThingTitle),
    starterLabel,
    firstThingTitle,
  };
}

export function getWorkSystemOnboardingSessionState(value: unknown): WorkSystemOnboardingSessionState {
  if (!value || typeof value !== 'object') return createEmptyOnboardingSessionState();
  const record = value as Record<string, unknown>;
  if (record.source !== WORK_SYSTEM_ONBOARDING_STATE_SOURCE) return createEmptyOnboardingSessionState();
  return {
    source: WORK_SYSTEM_ONBOARDING_STATE_SOURCE,
    initialMessage: typeof record.initialMessage === 'string' ? record.initialMessage : '',
    starterLabel: typeof record.starterLabel === 'string' ? record.starterLabel : '',
    firstThingTitle: typeof record.firstThingTitle === 'string' ? record.firstThingTitle : '',
  };
}

export function buildSkippedWorkspaceMatterCarryover(
  state: WorkSystemOnboardingSessionState,
  messages: TemporarySessionCarryoverMessage[] = [],
): FirstWorkbenchMatterCarryover {
  const title = state.firstThingTitle.trim();
  const clues = extractTemporarySessionClues(messages);
  const clueSummary = buildTemporarySessionClueSummary(clues);
  return {
    heading: '临时会话承接',
    note: [
      '用户先跳过工作空间开始体验，后续才把这件事沉淀为正式工作事项。',
      title ? `临时事项：${title}` : undefined,
      state.initialMessage.trim() ? `初始请求：${state.initialMessage.trim()}` : undefined,
      clueSummary,
    ]
      .filter(Boolean)
      .join('\n'),
    checklist: [
      '回看临时会话中的资料、结论和待办，补进本事项。',
      ...clues.outputs.map((item) => `沉淀成果线索：${item}`),
      ...clues.knowledge.map((item) => `更新知识线索：${item}`),
      ...clues.reviews.map((item) => `写入复盘线索：${item}`),
      '把已形成的成果沉淀到关联成果或 outputs。',
      '把可复用知识更新到 Knowledge，并保留来源线索。',
      '把值得复盘的判断、风险和下一步写入复盘。',
    ],
  };
}

export function buildSkippedWorkspaceSessionSourceArchive(
  state: WorkSystemOnboardingSessionState,
  messages: TemporarySessionCarryoverMessage[],
  options: TemporarySessionSourceArchiveOptions = {},
): TemporarySessionSourceArchive {
  const now = options.now ?? new Date();
  const title = `临时会话：${state.firstThingTitle.trim() || '未命名事项'}`;
  const sourceRoot = normalizeArchiveSourceRoot(options.sourceRoot ?? 'sources');
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const path = `${sourceRoot}/imported/${date}-${time}-temporary-session.md`;
  const sessionKey = options.sessionKey?.trim();
  const excerpts = buildTemporarySessionArchiveExcerpts(messages);
  const markdown = [
    '---',
    `title: ${JSON.stringify(title)}`,
    'source: desktop-onboarding-session',
    `temporaryMatterTitle: ${JSON.stringify(state.firstThingTitle.trim())}`,
    ...(sessionKey ? [`sessionKey: ${JSON.stringify(sessionKey)}`] : []),
    `importedAt: ${now.toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## 临时事项',
    '',
    state.firstThingTitle.trim() || '未命名事项',
    '',
    '## 初始请求',
    '',
    state.initialMessage.trim() || '暂无',
    '',
    '## 会话摘录',
    '',
    ...(excerpts.length ? excerpts : ['暂无可归档的可见会话内容。']),
    '',
  ].join('\n');

  return { title, path, markdown };
}

export async function archiveSkippedWorkspaceSessionSource(
  binding: RepositoryBinding,
  state: WorkSystemOnboardingSessionState,
  messages: TemporarySessionCarryoverMessage[],
  options: Omit<TemporarySessionSourceArchiveOptions, 'sourceRoot'> = {},
): Promise<TemporarySessionSourceArchive> {
  const writeText = typeof window !== 'undefined' ? window.electronAPI?.repository?.writeText : undefined;
  if (!writeText) throw new Error('Repository write API unavailable');
  const archive = buildSkippedWorkspaceSessionSourceArchive(state, messages, {
    ...options,
    sourceRoot: binding.knowledge.sourceRoot,
  });
  await writeText(binding.repoPath, archive.path, archive.markdown);
  return archive;
}

export async function loadSkippedWorkspaceSessionArchiveMessages(
  client: SkippedWorkspaceSessionHistoryClient | null | undefined,
  sessionKey: string | undefined,
  fallback: TemporarySessionCarryoverMessage[],
): Promise<TemporarySessionCarryoverMessage[]> {
  const key = sessionKey?.trim();
  if (!client || !key) return fallback;

  try {
    const result = await client.request('sessions.get', { key });
    const messages = extractSessionMessageItems(result)
      .map((message) => ({
        role: readTemporarySessionMessageRole(message),
        content: message,
      }))
      .filter((message) => temporarySessionContentToText(message.content).trim());
    return messages.length ? messages : fallback;
  } catch {
    return fallback;
  }
}

function extractTemporarySessionClues(messages: TemporarySessionCarryoverMessage[]): TemporarySessionClues {
  const clues: TemporarySessionClues = { outputs: [], knowledge: [], reviews: [] };

  for (const message of messages) {
    if (message.role === 'system') continue;
    const text = temporarySessionContentToText(message.content);
    for (const title of extractArtifactTitles(text)) addUniqueClue(clues.outputs, `Artifact 候选：${title}`);

    for (const line of text.split(/\r?\n/).map(cleanTemporarySessionLine).filter(Boolean)) {
      if (isOutputClueLine(line)) addUniqueClue(clues.outputs, line);
      else if (isKnowledgeClueLine(line)) addUniqueClue(clues.knowledge, line);
      else if (isReviewClueLine(line)) addUniqueClue(clues.reviews, line);
    }
  }

  return {
    outputs: clues.outputs.slice(0, 4),
    knowledge: clues.knowledge.slice(0, 4),
    reviews: clues.reviews.slice(0, 4),
  };
}

function temporarySessionContentToText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(temporarySessionContentToText).filter(Boolean).join('\n');
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  return [record.text, record.output_text, record.content, record.summary]
    .map(temporarySessionContentToText)
    .filter(Boolean)
    .join('\n');
}

function readTemporarySessionMessageRole(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const role = (value as Record<string, unknown>).role;
  return typeof role === 'string' ? role : undefined;
}

function extractArtifactTitles(text: string): string[] {
  return [...text.matchAll(/<artifact\b[\s\S]*?<\/artifact>/gi)]
    .map((match) => match[0].match(/"title"\s*:\s*"([^"]+)"/)?.[1])
    .filter((title): title is string => Boolean(title))
    .map(normalizeTemporarySessionClue)
    .filter(Boolean);
}

function cleanTemporarySessionLine(line: string): string {
  return normalizeTemporarySessionClue(
    line
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/^>\s+/, '')
      .replace(/^\[[ xX]\]\s+/, ''),
  );
}

function normalizeTemporarySessionClue(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function isOutputClueLine(line: string): boolean {
  return /^(成果|产物|输出|deliverable|artifact)\s*[:：]/i.test(line);
}

function isKnowledgeClueLine(line: string): boolean {
  return /^(知识|结论|事实|knowledge|insight)\s*[:：]/i.test(line);
}

function isReviewClueLine(line: string): boolean {
  return /^(复盘|风险|决定|下一步|review|risk|decision|next)\s*[:：]/i.test(line);
}

function addUniqueClue(target: string[], value: string): void {
  if (value && !target.includes(value)) target.push(value);
}

function buildTemporarySessionClueSummary(clues: TemporarySessionClues): string | undefined {
  const count = clues.outputs.length + clues.knowledge.length + clues.reviews.length;
  if (count === 0) return undefined;
  return `临时会话明示线索：成果 ${clues.outputs.length} 条，知识 ${clues.knowledge.length} 条，复盘 ${clues.reviews.length} 条。`;
}

function buildTemporarySessionArchiveExcerpts(messages: TemporarySessionCarryoverMessage[]): string[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message, index) => {
      const text = temporarySessionContentToText(message.content).trim();
      if (!text) return '';
      const role = normalizeArchiveRole(message.role);
      return [`### ${index + 1}. ${role}`, '', truncateArchiveText(text), ''].join('\n');
    })
    .filter(Boolean)
    .slice(0, 80);
}

function normalizeArchiveRole(role: string | undefined): string {
  if (role === 'user') return '用户';
  if (role === 'assistant') return '助手';
  return '消息';
}

function truncateArchiveText(value: string): string {
  const text = value.replace(/\r\n/g, '\n').trim();
  return text.length <= 4000 ? text : `${text.slice(0, 4000).trimEnd()}\n\n[已截断，仅保存前 4000 字符]`;
}

function normalizeArchiveSourceRoot(value: string): string {
  const root = value.trim().replace(/^\/+|\/+$/g, '');
  if (!root || root.includes('..') || root.includes('\\')) return 'sources';
  return root;
}

function createEmptyOnboardingSessionState(): WorkSystemOnboardingSessionState {
  return {
    source: WORK_SYSTEM_ONBOARDING_STATE_SOURCE,
    initialMessage: '',
    starterLabel: '',
    firstThingTitle: '',
  };
}
