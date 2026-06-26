import { loadRepositoryBinding } from './agentic-repository-store';
import {
  detectDesktopCompanion,
  setDesktopCompanionRepositoryContext,
  type DesktopCompanionStatus,
} from './desktop-companion';
import type { GatewayClient } from './gateway';
import {
  buildRepositoryContextPayload,
  type RepositoryContextPayload,
} from './repository-context';

const FALLBACK_AGENTS_MD_CONTENT = '仓库根目录 AGENTS.md 暂不可读。';

export type RepositoryContextSyncResult =
  | { status: 'synced'; payload: RepositoryContextPayload; companionStatus: 'ready'; warning?: string }
  | { status: 'no_binding' }
  | { status: 'repository_api_unavailable' }
  | { status: 'fallback_available'; reason: DesktopCompanionStatus | 'missing_capability' }
  | { status: 'failed'; message: string };

export async function syncRepositoryContextWithCompanion(
  client: GatewayClient,
  instanceId: string,
): Promise<RepositoryContextSyncResult> {
  try {
    const binding = await loadRepositoryBinding(instanceId);
    if (!binding) return { status: 'no_binding' };

    const companion = await detectDesktopCompanion(client);
    if (companion.status !== 'ready') {
      return { status: 'fallback_available', reason: companion.status };
    }
    if (!companion.capabilities.includes('repository-context')) {
      return { status: 'fallback_available', reason: 'missing_capability' };
    }

    const readText = typeof window !== 'undefined' ? window.electronAPI?.repository?.readText : undefined;
    if (!readText) return { status: 'repository_api_unavailable' };

    let agentsMdContent = FALLBACK_AGENTS_MD_CONTENT;
    let warning: string | undefined;
    try {
      agentsMdContent = await readText(binding.repoPath, 'AGENTS.md');
    } catch (error) {
      warning = `读取仓库根目录 AGENTS.md 失败，已使用占位内容同步：${error instanceof Error ? error.message : String(error)}`;
    }

    const payload = buildRepositoryContextPayload({ binding, agentsMdContent });
    const result = await setDesktopCompanionRepositoryContext(client, payload);
    if (result.ok === false) {
      return { status: 'failed', message: result.message || 'Repository context sync failed' };
    }

    return { status: 'synced', payload, companionStatus: 'ready', ...(warning ? { warning } : {}) };
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

export async function startRepositoryAgentsFileSyncWatcher(options: {
  repoPath: string;
  onChanged: () => void;
}): Promise<() => void> {
  if (typeof window === 'undefined') return () => {};

  const fallbackToInterval = () => {
    const intervalId = window.setInterval(options.onChanged, 15000);
    return () => window.clearInterval(intervalId);
  };

  const watchAgentsFile = window.electronAPI?.repository?.watchAgentsFile;

  if (!watchAgentsFile) {
    return fallbackToInterval();
  }

  try {
    return await watchAgentsFile(options.repoPath, () => options.onChanged());
  } catch (error) {
    console.warn('[startRepositoryAgentsFileSyncWatcher] watchAgentsFile failed; falling back to interval', error);
    return fallbackToInterval();
  }
}
