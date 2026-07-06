import agentTeamComposeTemplate from '../prompts/ai-actions/agent-team-compose.md?raw';
import approvalDecisionTemplate from '../prompts/ai-actions/approval-decision.md?raw';
import artifactCreateTemplate from '../prompts/ai-actions/artifact-create.md?raw';
import gatewayAgentCreateTemplate from '../prompts/ai-actions/gateway-agent-create.md?raw';
import planExecuteTemplate from '../prompts/ai-actions/plan-execute.md?raw';
import workMatterPlanTemplate from '../prompts/ai-actions/work-matter-plan.md?raw';
import { DEFAULT_SETTINGS, type ArtifactWriteChannel } from './settings-types';
import type { AgentLocalProfile } from './types';

export type ArtifactWriteSafety = 'standard' | 'local-file-reference' | 'executable-asset';
export type ArtifactWriteIntent =
  | 'standard'
  | 'html-artifact'
  | 'external-link'
  | 'local-file-reference'
  | 'executable-asset';

const LOCAL_FILE_REFERENCE_PATTERN =
  /(?:^|[\s"'`(（])(?:\/(?:Users|Volumes|home|tmp|var|opt|private)\/[^\s"'`，。；;）)]+|[A-Za-z]:\\[^\s"'`，。；;）]+|~\/[^\s"'`，。；;）]+)|\b(?:filePath\s*["'`]?\s*[:=]|importFile\s*["'`]?\b)/i;
const EXECUTABLE_ASSET_PATTERN =
  /(?:命令是|执行命令|运行命令|部署脚本|脚本|可执行|command\s*["'`]?\s*(?:is|[:=])|npm\s+run|pnpm\s+run|yarn\s+\w+|bun\s+run|python\s+\S+|node\s+\S+|bash\s+\S+|sh\s+\S+)/i;
const HTML_ARTIFACT_PATTERN = /(?:HTML|html|交互报告|可交互报告|交互式报告|自包含|dashboard|仪表盘)/i;
const EXTERNAL_LINK_PATTERN = /(?:https?:\/\/[^\s"'`，。；;）)]+|\burl\s*["'`]?\s*[:=]|链接)/i;

function inferArtifactWriteSafety(input: string): ArtifactWriteSafety {
  const normalized = input.trim();
  if (EXECUTABLE_ASSET_PATTERN.test(normalized)) return 'executable-asset';
  if (LOCAL_FILE_REFERENCE_PATTERN.test(normalized)) return 'local-file-reference';
  return 'standard';
}

function inferArtifactWriteIntent(input: string, safety: ArtifactWriteSafety): ArtifactWriteIntent {
  if (safety === 'executable-asset') return 'executable-asset';
  if (safety === 'local-file-reference') return 'local-file-reference';
  const normalized = input.trim();
  if (HTML_ARTIFACT_PATTERN.test(normalized)) return 'html-artifact';
  if (EXTERNAL_LINK_PATTERN.test(normalized)) return 'external-link';
  return 'standard';
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => values[key.trim()] ?? '');
}

function profileText(profile?: AgentLocalProfile): string {
  if (!profile) return '无预设画像，请根据用户意图生成计划。';
  return [
    `目标 Agent ID: ${profile.agentId}`,
    `展示名称: ${profile.displayName || profile.agentId}`,
    `角色/职责: ${profile.role || '待 OpenClaw 根据指令补全'}`,
    `人格摘要: ${profile.personality || '待 OpenClaw 根据指令补全'}`,
    `认知摘要: ${profile.cognition || '待 OpenClaw 根据指令补全'}`,
    `办公室头衔: ${profile.officeTitle || profile.role || 'Agent'}`,
    `办公室区域: ${profile.officeZone || 'work'}`,
  ].join('\n');
}

export function buildGatewayAgentCreatePrompt(options: { input: string; profile?: AgentLocalProfile }): string {
  return renderTemplate(gatewayAgentCreateTemplate, {
    input: options.input.trim(),
    profile: profileText(options.profile),
  });
}

export function buildAgentTeamComposePrompt(options: { input: string; profile?: AgentLocalProfile }): string {
  return renderTemplate(agentTeamComposeTemplate, {
    input: options.input.trim(),
    profile: profileText(options.profile),
  });
}

function artifactWriteChannelInstruction(channel: ArtifactWriteChannel): string {
  if (channel === 'preview-first') {
    return [
      '当前用户选择预览优先：不要调用 `desktop.artifacts.create` 或 `desktop.outputs.create`。',
      '请输出 `<artifact>` 块，让 Desktop 先展示候选预览，并等待用户显式保存后再写入 Artifact 或 Repository output。',
    ].join('\n');
  }
  if (channel === 'conversation-only') {
    return [
      '当前用户选择仅对话返回：仅使用对话返回结构化结果，不要执行任何 Desktop 插件直写。',
      '不要调用 `desktop.artifacts.create`，也不要调用 `desktop.outputs.create`；需要可保存内容时输出 `<artifact>` 块。',
    ].join('\n');
  }
  return [
    '当前用户选择自动直写并回退：优先调用 `desktop.artifacts.create` 创建 Artifact。',
    '当结果也需要沉淀到当前 Repository outputs 时，可调用 `desktop.outputs.create`；插件不可用或直写失败时输出 `<artifact>` 块回退。',
  ].join('\n');
}

function artifactWriteSafetyInstruction(safety: ArtifactWriteSafety): string {
  if (safety === 'local-file-reference') {
    return [
      '当前产物涉及本地文件或导入副本线索：不要静默导入本地文件。',
      '`filePath` / `importFile` 只能作为待用户确认的导入线索；除非 Desktop 明确提供确认后的导入能力，否则输出 `<artifact>` 候选让用户显式保存或导入。',
    ].join('\n');
  }
  if (safety === 'executable-asset') {
    return [
      '当前产物涉及可执行资产、脚本、工具、工作流或命令：不要执行命令。',
      '不要把 `command` 当作已获执行授权；可以记录为待审批的可复用资产线索，但执行、授权或写 Repository output 仍必须等待用户显式确认。',
    ].join('\n');
  }
  return '当前产物使用标准写入安全边界：直写仍必须遵守用户显式保存、Repository 写入审批和 Desktop Bridge 授权边界。';
}

function artifactWriteIntentInstruction(intent: ArtifactWriteIntent): string {
  if (intent === 'html-artifact') {
    return [
      'HTML 产物应优先生成自包含正文，并把可预览内容放入 `<artifact>` 块或经过确认的 `desktop.artifacts.create` 参数。',
      '不要依赖远程脚本、远程样式或未声明的 Desktop Bridge 权限；需要 Repository output 时仍走显式写入边界。',
    ].join('\n');
  }
  if (intent === 'external-link') {
    return [
      '外部链接产物应记录 URL、标题、说明和标签等元数据；不要抓取或打开 URL。',
      '除非用户另行要求生成摘要或报告，否则不要把链接内容伪装成已读取的事实。',
    ].join('\n');
  }
  if (intent === 'local-file-reference') {
    return [
      '文件类产物只记录待确认的导入线索、文件名、格式、MIME 或摘要，不要读取或复制本地文件。',
      '只有 Desktop 提供用户确认后的导入能力时，才能把 `importFile` 视为可执行导入请求。',
    ].join('\n');
  }
  if (intent === 'executable-asset') {
    return [
      '可执行资产只记录命令或脚本元数据、用途、输入输出和审批提示，不要运行命令。',
      '需要运行时必须走后续资产执行审批或 Desktop Bridge 授权，不能在创建产物时顺手执行。',
    ].join('\n');
  }
  return '标准产物按用户目标选择最小可保存结构；不能确认直写安全时使用 `<artifact>` 候选等待用户保存。';
}

export function buildArtifactCreatePrompt(options: {
  input: string;
  artifactWriteChannel?: ArtifactWriteChannel;
  artifactWriteSafety?: ArtifactWriteSafety;
}): string {
  const artifactWriteChannel = options.artifactWriteChannel ?? DEFAULT_SETTINGS.artifactWriteChannel;
  const artifactWriteSafety = options.artifactWriteSafety ?? inferArtifactWriteSafety(options.input);
  const artifactWriteIntent = inferArtifactWriteIntent(options.input, artifactWriteSafety);
  const prompt = renderTemplate(artifactCreateTemplate, {
    input: options.input.trim(),
  });
  return `${prompt.trimEnd()}\n\n## 当前 Artifact 写入偏好\n\nartifactWriteChannel: ${artifactWriteChannel}\nartifactWriteSafety: ${artifactWriteSafety}\nartifactWriteIntent: ${artifactWriteIntent}\n\n${artifactWriteChannelInstruction(artifactWriteChannel)}\n\n${artifactWriteSafetyInstruction(artifactWriteSafety)}\n\n${artifactWriteIntentInstruction(artifactWriteIntent)}\n`;
}

function promptRoot(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback).trim().replace(/^\/+|\/+$/g, '');
  return normalized || fallback;
}

export function buildWorkMatterPlanPrompt(options: {
  workItemPath: string;
  workItemContent: string;
  planRoot?: string;
}): string {
  const planRoot = promptRoot(options.planRoot, 'plans');
  return renderTemplate(workMatterPlanTemplate, {
    workItemPath: options.workItemPath.trim(),
    workItemContent: options.workItemContent.trim(),
    planActiveRoot: `${planRoot}/active`,
  });
}

export function buildPlanExecutePrompt(options: {
  planPath: string;
  planContent: string;
  workItemPath?: string;
  workItemContent?: string;
}): string {
  return renderTemplate(planExecuteTemplate, {
    planPath: options.planPath.trim(),
    planContent: options.planContent.trim(),
    workItemPath: options.workItemPath?.trim() || '未关联事项',
    workItemContent: options.workItemContent?.trim() || '未关联事项内容。',
  });
}

export function buildApprovalDecisionPrompt(options: {
  decision: 'approved' | 'rejected';
  approvalTitle: string;
  actionInput: string;
}): string {
  return renderTemplate(approvalDecisionTemplate, {
    actionInput: options.actionInput.trim(),
    approvalTitle: options.approvalTitle.trim(),
    decision: options.decision === 'approved' ? 'approved / 已批准' : 'rejected / 已拒绝',
    decisionInstruction:
      options.decision === 'approved'
        ? '该方案已获批准。立即执行已经批准的方案，不要再次询问同一审批。'
        : '该方案已被拒绝。停止执行，不要进行任何有副作用的操作，并说明已取消。',
  });
}
