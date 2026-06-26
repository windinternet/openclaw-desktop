import { extractSessionMessageText } from './session-content';
import type { RepositoryMarkdownFile } from './repository-knowledge';
import type { WorkbenchSnapshot, WorkbenchTaskGroup } from './repository-workbench';

export interface NewSessionCreateParams {
  request: {
    agentId: string;
    key: string;
    model?: string;
    label?: string;
  };
  agentId: string;
  key: string;
  peerKey: string;
  title?: string;
}

export interface NewSessionInitialMessage {
  content: unknown;
  model?: string;
  thinking?: string;
}

export interface NewSessionNavigationTarget {
  to: string;
  state?: {
    initialMessage: NewSessionInitialMessage;
  };
}

export interface NewSessionWorkbenchContinuation {
  id: string;
  title: string;
  meta: string;
  sourcePath: string;
  kind: 'task' | 'work' | 'plan' | 'next';
  message: string;
}

function generateDashboardPeerKey(): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  return `dashboard:${id}`;
}

export function buildDashboardSessionKey(agentId: string, peerKey: string): string {
  return `agent:${agentId}:${peerKey}`;
}

export function buildNewSessionCreateParams(options: {
  agentId: string;
  model?: string;
  thinking?: string;
  content?: unknown;
}): NewSessionCreateParams {
  const peerKey = generateDashboardPeerKey();
  const sessionKey = buildDashboardSessionKey(options.agentId, peerKey);
  const title = extractSessionMessageText(options.content).trim();
  const uniqueSuffix = Date.now().toString(36).slice(-4);

  return {
    request: {
      agentId: options.agentId,
      key: sessionKey,
      model: options.model,
      label: title ? `${title.slice(0, 36)} · ${uniqueSuffix}` : undefined,
    },
    agentId: options.agentId,
    key: sessionKey,
    peerKey,
    title: title || undefined,
  };
}

export function resolveCreatedSessionKey(
  response: { key?: string; sessionKey?: string } | null | undefined,
  fallbackKey: string,
): string {
  return response?.key || response?.sessionKey || fallbackKey;
}

export function getChatRoute(sessionKey: string): string {
  return `/chat/${encodeURIComponent(sessionKey)}`;
}

export function buildNewSessionNavigationTarget(options: {
  sessionKey: string;
  content: unknown;
  model?: string;
  thinking?: string;
}): NewSessionNavigationTarget {
  const message = extractSessionMessageText(options.content).trim();
  if (!message) return { to: getChatRoute(options.sessionKey) };

  return {
    to: getChatRoute(options.sessionKey),
    state: {
      initialMessage: {
        content: options.content,
        model: options.model,
        thinking: options.thinking,
      },
    },
  };
}

function trimMarkdownExtension(name: string): string {
  return name.replace(/\.md$/i, '').trim();
}

function buildWorkbenchContinuationMessage(options: {
  title: string;
  sourcePath: string;
  target: 'task' | 'document';
}): string {
  const action =
    options.target === 'task' ? `继续推进工作台事项「${options.title}」` : `继续处理工作台文档「${options.title}」`;

  return [
    `${action}。`,
    '请先基于工作台记录复盘当前状态，识别阻塞、依赖和已经完成的部分。',
    '然后给出可以立即执行的下一步，并在需要修改仓库内容前先列出计划。',
    `参考来源：${options.sourcePath}`,
  ].join('\n');
}

function taskGroupPriority(group: WorkbenchTaskGroup): number {
  if (group.id === 'current') return 0;
  if (group.id === 'next') return 1;
  return 2;
}

function fileContinuation(
  file: RepositoryMarkdownFile,
  kind: NewSessionWorkbenchContinuation['kind'],
  meta: string,
): NewSessionWorkbenchContinuation {
  const title = trimMarkdownExtension(file.name || file.path.split('/').pop() || file.path);
  return {
    id: `${kind}:${file.path}`,
    title,
    meta,
    sourcePath: file.path,
    kind,
    message: buildWorkbenchContinuationMessage({
      title,
      sourcePath: file.path,
      target: 'document',
    }),
  };
}

export function buildNewSessionWorkbenchContinuations(
  snapshot: WorkbenchSnapshot | null | undefined,
  limit = 4,
): NewSessionWorkbenchContinuation[] {
  if (!snapshot) return [];

  const taskContinuations = [...snapshot.taskGroups]
    .sort((a, b) => taskGroupPriority(a) - taskGroupPriority(b))
    .flatMap((group) =>
      group.items
        .filter((item) => !item.completed)
        .map((item) => ({
          id: `task:${item.id}`,
          title: item.text,
          meta: group.title,
          sourcePath: item.sourcePath,
          kind: 'task' as const,
          message: buildWorkbenchContinuationMessage({
            title: item.text,
            sourcePath: item.sourcePath,
            target: 'task',
          }),
        })),
    );

  const fallbackFiles = [
    ...snapshot.activePlans.map((file) => ({ file, kind: 'plan' as const, meta: '执行计划' })),
    ...snapshot.activeWork.map((file) => ({ file, kind: 'work' as const, meta: '进行中的事项' })),
    ...snapshot.somedayWork.map((file) => ({ file, kind: 'next' as const, meta: '下一步候选' })),
  ]
    .sort((a, b) => b.file.updatedAt - a.file.updatedAt)
    .map(({ file, kind, meta }) => fileContinuation(file, kind, meta));

  const seen = new Set<string>();
  return [...taskContinuations, ...fallbackFiles]
    .filter((item) => {
      const key = item.kind === 'task' ? item.id : item.sourcePath || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
