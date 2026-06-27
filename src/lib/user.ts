/**
 * 从 OpenClaw Gateway 获取 Agent 对用户的认知
 *
 * 使用 Gateway RPC: agents.files.list + agents.files.get
 * 读取 workspace 中的 USER.md 文件并解析为结构化数据
 */

import { marked, type Token, type Tokens } from 'marked';
import type { GatewayClient } from './gateway';
import type { GatewayUser } from './types';

/** agents.files.list 返回的单个文件条目 */
interface AgentFileEntry {
  name: string;
  size?: number;
  modifiedAt?: number;
}

/**
 * 解析 USER.md Markdown → 结构化 GatewayUser
 *
 * 使用 marked lexer 将 Markdown token 化，从中提取键值对。
 * 社区约定格式为无序列表，加粗 Key，冒号跟 Value：
 *
 * ```markdown
 * - **Name:** 张三
 * - **What to call them:** 老张
 * - **Timezone:** Asia/Shanghai
 * - **OS:** macOS 15.4
 * - **Notes:**
 *   - 喜欢简洁的回答
 * ```
 */
function parseUserMd(markdown: string): GatewayUser | null {
  const tokens = marked.lexer(markdown);
  const fields: Record<string, string> = {};

  function walk(toks: Token[]): void {
    for (const tok of toks) {
      if (tok.type === 'list') {
        for (const item of (tok as Tokens.List).items) {
          processListItem(item);
        }
      } else {
        // 递归处理嵌套结构
        const children = (tok as { tokens?: Token[] }).tokens;
        if (children) walk(children);
      }
    }
  }

  function processListItem(item: Tokens.ListItem): void {
    const strongToken = findStrong(item.tokens);
    if (!strongToken) {
      // 嵌套列表
      walk(item.tokens);
      return;
    }

    const raw = strongToken.text.trim();
    // Key 是冒号前的部分，去掉末尾冒号
    const colonIdx = Math.max(raw.lastIndexOf(':'), raw.lastIndexOf('：'));
    if (colonIdx === -1) return;
    const key = raw.slice(0, colonIdx).trim();

    // Value 是 strong 后面同级的纯文本
    const afterText = textAfterStrong(item.tokens);
    if (afterText) {
      fields[key] = afterText;
    }

    // Notes 特殊处理：嵌套子列表
    if (key === 'Notes') {
      const nestedText = extractNestedListText(item.tokens);
      if (nestedText) {
        fields[key] = nestedText;
      }
    }
  }

  /** 在 token 树中找到第一个 strong token */
  function findStrong(tokens: Token[]): Tokens.Strong | null {
    for (const tok of tokens) {
      if (tok.type === 'text') {
        for (const inner of (tok as Tokens.Text).tokens ?? []) {
          if (inner.type === 'strong') return inner as Tokens.Strong;
        }
      }
    }
    return null;
  }

  /** 获取 strong 后面的纯文本（同级 text token 中 strong 之后的内容） */
  function textAfterStrong(tokens: Token[]): string | undefined {
    for (const tok of tokens) {
      if (tok.type === 'text') {
        const innerTokens = (tok as Tokens.Text).tokens ?? [];
        let foundStrong = false;
        const parts: string[] = [];
        for (const inner of innerTokens) {
          if (inner.type === 'strong') {
            foundStrong = true;
            continue;
          }
          if (foundStrong && inner.type === 'text') {
            parts.push(inner.text);
          }
        }
        const joined = parts.join('').trim();
        if (joined) return joined;
      }
    }
    return undefined;
  }

  /** 提取嵌套列表的文本（Notes 场景） */
  function extractNestedListText(tokens: Token[]): string | undefined {
    for (const tok of tokens) {
      if (tok.type === 'list') {
        const lines: string[] = [];
        for (const item of (tok as Tokens.List).items) {
          const text = item.text.trim();
          if (text) lines.push(text);
        }
        return lines.join('\n') || undefined;
      }
    }
    return undefined;
  }

  walk(tokens);

  if (!fields['Name']) return null;

  return {
    name: fields['Name'],
    whatToCall: fields['What to call them'] ?? fields['Name'],
    timezone: fields['Timezone'],
    os: fields['OS'],
    notes: fields['Notes'],
  };
}

/**
 * 从 Gateway 获取默认 Agent 的用户画像
 *
 * @param client 已连接的 GatewayClient（必须已完成 connect 握手）
 * @param agentId 目标 Agent ID，默认 "main"
 */
export async function fetchUserProfile(client: GatewayClient, agentId: string = 'main'): Promise<GatewayUser | null> {
  try {
    // Step 1: 确认 USER.md 是否存在
    const listData = await client.request<{ files?: AgentFileEntry[] } | AgentFileEntry[]>('agents.files.list', {
      agentId,
    });
    const files = Array.isArray(listData) ? listData : (listData?.files ?? []);
    const hasUserMd = files.some((f) => f.name === 'USER.md');
    if (!hasUserMd) {
      console.warn(`[fetchUserProfile] USER.md not found for agent "${agentId}"`);
      return null;
    }

    // Step 2: 读取 USER.md 内容
    const fileData = await client.request<{ file?: { content?: string } } | { content?: string } | string>(
      'agents.files.get',
      {
        agentId,
        name: 'USER.md',
      },
    );

    const content: string | undefined =
      typeof fileData === 'string'
        ? fileData
        : (fileData as Record<string, unknown>)?.file && typeof (fileData as Record<string, unknown>).file === 'object'
          ? (((fileData as Record<string, unknown>).file as Record<string, unknown>)?.content as string | undefined)
          : (fileData as { content?: string })?.content;

    if (!content) {
      console.warn(`[fetchUserProfile] USER.md is empty for agent "${agentId}"`);
      return null;
    }

    // Step 3: 解析为结构化数据
    return parseUserMd(content);
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
