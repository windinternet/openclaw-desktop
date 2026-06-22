import agentTeamComposeTemplate from '../prompts/ai-actions/agent-team-compose.md?raw';
import approvalDecisionTemplate from '../prompts/ai-actions/approval-decision.md?raw';
import artifactCreateTemplate from '../prompts/ai-actions/artifact-create.md?raw';
import gatewayAgentCreateTemplate from '../prompts/ai-actions/gateway-agent-create.md?raw';
import type { AgentLocalProfile } from './types';

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

export function buildArtifactCreatePrompt(options: { input: string }): string {
  return renderTemplate(artifactCreateTemplate, {
    input: options.input.trim(),
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
