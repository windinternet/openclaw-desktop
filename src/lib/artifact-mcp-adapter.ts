import type { GatewayClient } from './gateway';
import { artifactService, type GenerateParams } from './artifact-service';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const ARTIFACT_TOOLS: ToolDefinition[] = [
  {
    name: 'desktop.artifact.generate',
    description: '生成 HTML 产物。当用户要求生成报告、分析、仪表盘、清单等输出时使用。模板路径：指定 templateId + data 渲染模板。自由路径：不指定 templateId，直接提供 html。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '产物标题' },
        type: { type: 'string', enum: ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'] },
        icon: { type: 'string', description: 'emoji 图标' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        templateId: { type: 'string', description: '模板 ID，不填则使用自由路径' },
        data: { type: 'object', description: '模板数据（模板路径时有效）' },
        html: { type: 'string', description: '完整 HTML（自由路径时使用）' },
      },
      required: ['title'],
    },
  },
  {
    name: 'desktop.artifact.append',
    description: '向已有产物追加 HTML 内容',
    inputSchema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string', description: '产物 ID' },
        htmlChunk: { type: 'string', description: '追加的 HTML 内容' },
      },
      required: ['artifactId', 'htmlChunk'],
    },
  },
  {
    name: 'desktop.artifact.update',
    description: '更新产物元数据',
    inputSchema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string', description: '产物 ID' },
        title: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      },
      required: ['artifactId'],
    },
  },
];

export async function registerArtifactMcpTools(client: GatewayClient): Promise<void> {
  // Legacy bridge only. The official path is the OpenClaw Desktop Companion
  // plugin registering real Gateway tools and forwarding execution via
  // node.invoke to this Desktop app.
  client.subscribeEvent(async (frame) => {
    if (frame.event === 'mcp.tool.call' && frame.payload) {
      const payload = frame.payload as { name: string; args: Record<string, unknown>; requestId?: string };
      if (!ARTIFACT_TOOLS.some((t) => t.name === payload.name)) return;

      let result: unknown;
      try {
        if (payload.name === 'desktop.artifact.generate') {
          const params = payload.args as unknown as GenerateParams;
          result = await artifactService.generate(params);
        } else if (payload.name === 'desktop.artifact.append') {
          await artifactService.append(payload.args.artifactId as string, payload.args.htmlChunk as string);
          result = { success: true };
        } else if (payload.name === 'desktop.artifact.update') {
          await artifactService.update(payload.args.artifactId as string, payload.args as Record<string, unknown>);
          result = { success: true };
        }
      } catch (e) {
        result = { error: String(e) };
      }

      if (payload.requestId && typeof client.request === 'function') {
        try {
          await client.request('mcp.tool.result', { requestId: payload.requestId, result });
        } catch {
          // 静默失败
        }
      }
    }
  });
}
