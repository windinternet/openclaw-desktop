/**
 * 从 OpenClaw Gateway 获取 Agent 对用户的认知
 *
 * 使用 Gateway RPC: agents.files.list + agents.files.get
 * 读取 workspace 中的 USER.md 文件并解析为结构化数据
 */

import type { GatewayClient } from './gateway';
import type { GatewayUser } from './types';

/** agents.files.list 返回的单个文件条目 */
interface AgentFileEntry {
  name: string;
  size?: number;
  modifiedAt?: number;
}

/** agents.files.get 返回的文件内容 */
interface AgentFileContent {
  name: string;
  content: string;
  size?: number;
  modifiedAt?: number;
}

/**
 * 解析 USER.md Markdown → 结构化 GatewayUser
 *
 * OpenClaw 的 USER.md 没有强制格式，但社区约定如下：
 *
 * ```markdown
 * ## User Profile
 * - **Name**: 张三
 * - **What to call them**: 老张
 * - **Timezone**: Asia/Shanghai (UTC+8)
 * - **OS**: macOS 15.4
 *
 * ## Notes
 * 喜欢简洁的回答...
 * ```
 */
function parseUserMd(markdown: string): GatewayUser | null {
  const extract = (key: string): string | undefined => {
    const re = new RegExp(`-\\s*\\*\\*${key}\\*\\*[:：]\\s*(.+)`, 'im');
    return markdown.match(re)?.[1]?.trim();
  };
  const extractSection = (heading: string): string | undefined => {
    const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'im');
    return markdown.match(re)?.[1]?.trim();
  };

  const name = extract('Name');
  if (!name) return null;

  return {
    name,
    whatToCall: extract('What to call them') ?? name,
    timezone: extract('Timezone'),
    os: extract('OS'),
    notes: extractSection('Notes'),
  };
}

/**
 * 从 Gateway 获取默认 Agent 的用户画像
 *
 * @param client 已连接的 GatewayClient（必须已完成 connect 握手）
 * @param agentId 目标 Agent ID，默认 "main"
 */
export async function fetchUserProfile(
  client: GatewayClient,
  agentId: string = 'main',
): Promise<GatewayUser | null> {
  try {
    // Step 1: 确认 USER.md 是否存在
    const files = await client.request<AgentFileEntry[]>('agents.files.list', {
      agentId,
    });
    const hasUserMd = files.some((f) => f.name === 'USER.md');
    if (!hasUserMd) {
      console.warn(`[fetchUserProfile] USER.md not found for agent "${agentId}"`);
      return null;
    }

    // Step 2: 读取 USER.md 内容
    const result = await client.request<AgentFileContent>('agents.files.get', {
      agentId,
      name: 'USER.md',
    });

    if (!result?.content) {
      console.warn(`[fetchUserProfile] USER.md is empty for agent "${agentId}"`);
      return null;
    }

    // Step 3: 解析为结构化数据
    return parseUserMd(result.content);
  } catch (err) {
    console.error(`[fetchUserProfile] failed for agent "${agentId}":`, err);
    return null;
  }
}

/**
 * 便捷函数：独立连接 → 获取用户画像 → 断开
 *
 * 用于一次性获取场景（如连接向导中）。
 * 已有长连接的场景请直接使用 fetchUserProfile(client)。
 */
export async function fetchGatewayUser(
  gatewayUrl: string,
  token: string,
  agentId: string = 'main',
): Promise<GatewayUser | null> {
  const { createGatewayClient } = await import('./gateway');
  const client = createGatewayClient({ url: gatewayUrl, token });

  try {
    await client.connect();
    return await fetchUserProfile(client, agentId);
  } finally {
    client.disconnect();
  }
}
