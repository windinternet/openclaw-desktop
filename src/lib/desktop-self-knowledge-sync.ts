import {
  detectDesktopCompanion,
  setDesktopCompanionSelfKnowledge,
  type DesktopCompanionStatus,
} from './desktop-companion';
import type { GatewayClient } from './gateway';
import { buildDesktopSelfKnowledgePayload, type DesktopSelfKnowledgePayload } from './desktop-self-knowledge';
import {
  type DesktopSelfKnowledgeFallbackResult,
  syncDesktopSelfKnowledgeToAgentFiles,
} from './desktop-self-knowledge-fallback';

export const DESKTOP_SELF_KNOWLEDGE_COMPANION_CAPABILITY = 'desktop-self-knowledge';

export type DesktopSelfKnowledgeSyncResult =
  | { status: 'synced'; payload: DesktopSelfKnowledgePayload; companionStatus: 'ready' }
  | {
      status: 'fallback_synced';
      payload: DesktopSelfKnowledgePayload;
      reason: DesktopCompanionStatus | 'missing_capability';
      fallback: DesktopSelfKnowledgeFallbackResult;
    }
  | {
      status: 'fallback_partial';
      payload: DesktopSelfKnowledgePayload;
      reason: DesktopCompanionStatus | 'missing_capability';
      fallback: DesktopSelfKnowledgeFallbackResult;
    }
  | { status: 'failed'; message: string };

export async function syncDesktopSelfKnowledgeWithCompanion(
  client: GatewayClient,
): Promise<DesktopSelfKnowledgeSyncResult> {
  try {
    const payload = buildDesktopSelfKnowledgePayload();
    const companion = await detectDesktopCompanion(client);

    if (companion.status === 'ready' && companion.capabilities.includes(DESKTOP_SELF_KNOWLEDGE_COMPANION_CAPABILITY)) {
      const result = await setDesktopCompanionSelfKnowledge(client, payload);
      if (result.ok === false) {
        return { status: 'failed', message: result.message || 'Desktop self-knowledge sync failed' };
      }

      return { status: 'synced', payload, companionStatus: 'ready' };
    }

    const reason = companion.status === 'ready' ? 'missing_capability' : companion.status;
    const fallback = await syncDesktopSelfKnowledgeToAgentFiles(client, payload);
    return {
      status: fallback.failed.length > 0 ? 'fallback_partial' : 'fallback_synced',
      payload,
      reason,
      fallback,
    };
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}
