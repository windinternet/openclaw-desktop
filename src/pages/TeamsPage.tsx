import { useState, useCallback, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconAppCenter,
  IconBox,
  IconBulb,
  IconEdit,
  IconFile,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSend,
  IconServer,
  IconUserGroup,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  AGENT_TEAM_PROFILE_STORAGE_KEY,
  createAgentFromNaturalLanguage,
  createEmptyAgentTeamProfile,
  createInstruction,
  markAgentProfileBindingFailed,
  mergeAgentTeamMembers,
  normalizeAgentTeamProfile,
  reconcileAgentTeamProfileWithGateway,
  shouldCreateAgentFromInstruction,
  upsertAgentProfile,
  type AgentTeamMember,
} from '../lib/agent-team';
import { createAiActionRun, executeAiActionRunWithGateway } from '../lib/ai-action-center';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import { buildAgentTeamComposePrompt, buildGatewayAgentCreatePrompt } from '../lib/ai-action-prompts';
import { loadInstanceData, saveInstanceDataAwaited } from '../lib/local-persistence';
import { useStore } from '../lib';
import AgentFilesPanel from '../components/AgentFilesPanel';
import type { AiActionRun, AgentLocalProfile, AgentOfficeZone, AgentTeamProfile } from '../lib/types';

const { Title, Text } = Typography;

const TEAM_PANEL_STYLE: CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--semi-color-border)',
  background: 'var(--semi-color-bg-1)',
};

const PROFILE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

interface ProfileDraft {
  displayName: string;
  role: string;
  personality: string;
  cognition: string;
  memorySummary: string;
  officeTitle: string;
  officeZone: AgentOfficeZone;
  color: string;
}

interface QuickAgentDraft {
  displayName: string;
  role: string;
  personality: string;
}

function agentModelString(model: unknown): string {
  if (typeof model === 'string') return model;
  if (model && typeof model === 'object' && 'primary' in model) {
    return String((model as Record<string, unknown>).primary ?? '');
  }
  return '';
}

function agentNameString(name: unknown): string {
  if (typeof name === 'string') return name;
  return '';
}

function getAgentStatusColor(status?: string): 'green' | 'orange' | 'red' | 'grey' {
  switch (status) {
    case 'running':
      return 'green';
    case 'idle':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'grey';
  }
}

function getAgentStatusLabel(status?: string): string {
  return status ?? 'unknown';
}

function formatTime(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function profileDraftFromMember(member: AgentTeamMember): ProfileDraft {
  return {
    displayName: member.profile.displayName ?? agentNameString(member.agent.name) ?? member.agent.id,
    role: member.profile.role ?? '',
    personality: member.profile.personality ?? '',
    cognition: member.profile.cognition ?? '',
    memorySummary: member.profile.memorySummary ?? '',
    officeTitle: member.profile.officeTitle ?? '',
    officeZone: member.profile.officeZone ?? 'work',
    color: member.profile.color ?? PROFILE_COLORS[0],
  };
}

function createGatewayAgentId(name: string, existingIds: Set<string>): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'agent';
  let id = base;
  let index = 2;
  while (existingIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function buildQuickAgentProfile(values: QuickAgentDraft, profile: AgentTeamProfile): AgentLocalProfile {
  const timestamp = Date.now();
  const displayName = values.displayName.trim() || '新 Agent';
  return {
    agentId: createGatewayAgentId(displayName, new Set(Object.keys(profile.agents))),
    displayName,
    role: values.role.trim(),
    personality: values.personality.trim(),
    officeTitle: values.role.trim().slice(0, 24),
    officeZone: 'work',
    color: PROFILE_COLORS[timestamp % PROFILE_COLORS.length],
    source: 'gateway',
    bindingStatus: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function AgentRosterItem({
  member,
  selected,
  onSelect,
}: {
  member: AgentTeamMember;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...TEAM_PANEL_STYLE,
        width: '100%',
        padding: 14,
        cursor: 'pointer',
        textAlign: 'left',
        background: selected ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-1)',
        borderColor: selected ? 'var(--semi-color-primary)' : 'var(--semi-color-border)',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: `${member.profile.color ?? PROFILE_COLORS[0]}1f`,
            color: member.profile.color ?? PROFILE_COLORS[0],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {member.agent.identity?.emoji ? <span>{member.agent.identity.emoji}</span> : <IconServer />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text strong style={{ display: 'block' }} ellipsis>
            {member.profile.displayName || agentNameString(member.agent.name) || member.agent.id}
          </Text>
          <Text type="tertiary" size="small" ellipsis style={{ display: 'block' }}>
            {member.profile.role || member.agent.workspace || member.agent.id}
          </Text>
        </div>
        <Tag color={member.source === 'local' ? 'blue' : getAgentStatusColor(member.agent.status)} size="small">
          {member.source === 'local' ? 'local' : getAgentStatusLabel(member.agent.status)}
        </Tag>
      </div>
    </button>
  );
}

export default function TeamsPage() {
  const { t } = useTranslation();

  const agents = useStore((s) => s.agents);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const activeClient = useStore((s) => s.activeClient);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);

  const [teamProfile, setTeamProfile] = useState<AgentTeamProfile>(() => createEmptyAgentTeamProfile());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerModalVisible, setComposerModalVisible] = useState(false);
  const [quickModalVisible, setQuickModalVisible] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [quickDraft, setQuickDraft] = useState<QuickAgentDraft>({
    displayName: '',
    role: '',
    personality: '',
  });
  const [profileDrafts, setProfileDrafts] = useState<Record<string, ProfileDraft>>({});
  const members = useMemo(() => mergeAgentTeamMembers(agents, teamProfile), [agents, teamProfile]);
  const selectedMember = members.find((member) => member.agent.id === selectedAgentId) ?? members[0] ?? null;
  const currentProfileDraft = useMemo(
    () =>
      selectedMember
        ? (profileDrafts[selectedMember.agent.id] ?? profileDraftFromMember(selectedMember))
        : {
            displayName: '',
            role: '',
            personality: '',
            cognition: '',
            memorySummary: '',
            officeTitle: '',
            officeZone: 'work' as AgentOfficeZone,
            color: PROFILE_COLORS[0],
          },
    [profileDrafts, selectedMember],
  );
  const isLoading = profileLoading;
  const isConnected = connectionStatus === 'connected';
  const gatewayAgentCount = members.filter((member) => member.source === 'gateway').length;
  const pendingProfileCount = Object.keys(teamProfile.agents).filter(
    (agentId) =>
      teamProfile.agents[agentId].bindingStatus !== 'failed' && !agents.some((agent) => agent.id === agentId),
  ).length;
  const failedProfileCount = Object.values(teamProfile.agents).filter(
    (profile) => profile.bindingStatus === 'failed',
  ).length;

  const persistProfile = useCallback(
    async (nextProfile: AgentTeamProfile) => {
      setTeamProfile(nextProfile);
      if (currentInstanceId) {
        await saveInstanceDataAwaited(currentInstanceId, AGENT_TEAM_PROFILE_STORAGE_KEY, nextProfile);
      }
    },
    [currentInstanceId],
  );

  const upsertActionRun = useCallback(
    async (run: AiActionRun) => {
      if (!currentInstanceId) return;
      await upsertAiActionRun(currentInstanceId, run);
    },
    [currentInstanceId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!currentInstanceId) {
        setTeamProfile(createEmptyAgentTeamProfile());
        return;
      }
      setProfileLoading(true);
      try {
        const stored = await loadInstanceData<AgentTeamProfile>(currentInstanceId, AGENT_TEAM_PROFILE_STORAGE_KEY);
        if (!cancelled) setTeamProfile(normalizeAgentTeamProfile(stored));
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [actionRunsVersion, currentInstanceId]);

  useEffect(() => {
    if (agents.length === 0) return;
    const reconciled = reconcileAgentTeamProfileWithGateway(agents, teamProfile);
    if (reconciled !== teamProfile) {
      queueMicrotask(() => {
        void persistProfile(reconciled);
      });
    }
  }, [agents, persistProfile, teamProfile]);

  const updateCurrentProfileDraft = useCallback(
    (updates: Partial<ProfileDraft>) => {
      if (!selectedMember) return;
      setProfileDrafts((drafts) => ({
        ...drafts,
        [selectedMember.agent.id]: {
          ...(drafts[selectedMember.agent.id] ?? profileDraftFromMember(selectedMember)),
          ...updates,
        },
      }));
    },
    [selectedMember],
  );

  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await useStore.getState().fetchAgents();
      Toast.success('Agents 已刷新');
    } catch {
      Toast.error('刷新 Agents 失败');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleSaveProfile = useCallback(() => {
    if (!selectedMember) return;
    const timestamp = Date.now();
    const nextAgentProfile: AgentLocalProfile = {
      ...selectedMember.profile,
      agentId: selectedMember.agent.id,
      displayName: currentProfileDraft.displayName.trim() || selectedMember.agent.id,
      role: currentProfileDraft.role.trim(),
      personality: currentProfileDraft.personality.trim(),
      cognition: currentProfileDraft.cognition.trim(),
      memorySummary: currentProfileDraft.memorySummary.trim(),
      officeTitle: currentProfileDraft.officeTitle.trim(),
      officeZone: currentProfileDraft.officeZone,
      color: currentProfileDraft.color,
      source: selectedMember.source,
      createdAt: selectedMember.profile.createdAt || timestamp,
      updatedAt: timestamp,
    };
    void persistProfile(upsertAgentProfile(teamProfile, nextAgentProfile));
    Toast.success('Agent 本地画像已保存');
  }, [currentProfileDraft, persistProfile, selectedMember, teamProfile]);

  const handleCompose = useCallback(async () => {
    const text = composerText.trim();
    if (!text) {
      Toast.warning('先写一句你想怎样编排团队');
      return;
    }
    if (!currentInstanceId) {
      Toast.error('缺少当前实例，无法记录 ActionRun');
      return;
    }
    if (!activeClient || connectionStatus !== 'connected') {
      Toast.error('未连接 Gateway，无法执行团队编排');
      return;
    }

    setActionSubmitting(true);
    const createsAgent = shouldCreateAgentFromInstruction(text);
    const baseActionRun = createAiActionRun({
      type: createsAgent ? 'gateway_agent_create' : 'agent_team_compose',
      sourcePage: 'teams',
      instanceId: currentInstanceId,
      agentId: selectedMember?.agent.id || agents.find((agent) => agent.default)?.id || agents[0]?.id || 'main',
      input: text,
      executionMode: 'isolated-session',
    });
    let nextProfile = teamProfile;
    let desiredProfile: AgentLocalProfile | undefined;
    if (createsAgent) {
      const parsedProfile = createAgentFromNaturalLanguage(text);
      desiredProfile = {
        ...parsedProfile,
        agentId: createGatewayAgentId(
          parsedProfile.displayName ?? parsedProfile.agentId,
          new Set(Object.keys(nextProfile.agents)),
        ),
        source: 'gateway',
        bindingStatus: 'pending',
      };
      nextProfile = upsertAgentProfile(nextProfile, desiredProfile);
      nextProfile = {
        ...nextProfile,
        instructions: [createInstruction(text, desiredProfile.agentId), ...nextProfile.instructions],
      };
    } else {
      nextProfile = {
        ...nextProfile,
        instructions: [createInstruction(text), ...nextProfile.instructions],
      };
    }

    await persistProfile(nextProfile);
    const actionRun = {
      ...baseActionRun,
      targetAgentId: desiredProfile?.agentId,
    };
    await upsertActionRun({ ...actionRun, status: 'planning', updatedAt: Date.now() });
    try {
      const updatedRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: createsAgent ? '创建 Gateway Agent' : 'Agent 团队编排',
        prompt: createsAgent
          ? buildGatewayAgentCreatePrompt({ input: text, profile: desiredProfile })
          : buildAgentTeamComposePrompt({ input: text, profile: desiredProfile }),
      });
      await upsertActionRun(updatedRun);
      useStore.getState().fetchSessions();
      Toast.success('已提交到 Gateway 执行会话');
      setComposerText('');
      setComposerModalVisible(false);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Gateway 执行失败';
      if (desiredProfile) {
        await persistProfile(markAgentProfileBindingFailed(nextProfile, desiredProfile.agentId, error));
      }
      await upsertActionRun({
        ...actionRun,
        status: 'failed',
        error,
        updatedAt: Date.now(),
      });
      Toast.error(error);
    } finally {
      setActionSubmitting(false);
    }
  }, [
    activeClient,
    agents,
    connectionStatus,
    composerText,
    currentInstanceId,
    persistProfile,
    selectedMember,
    teamProfile,
    upsertActionRun,
  ]);

  const handleQuickAdd = useCallback(async () => {
    if (!quickDraft.displayName.trim()) {
      Toast.warning('请填写 Agent 名称');
      return;
    }
    if (!currentInstanceId) {
      Toast.error('缺少当前实例，无法记录 ActionRun');
      return;
    }
    if (!activeClient || connectionStatus !== 'connected') {
      Toast.error('未连接 Gateway，无法创建 Agent');
      return;
    }

    setActionSubmitting(true);
    const desiredProfile = buildQuickAgentProfile(quickDraft, teamProfile);
    const input = `创建 Gateway Agent：${desiredProfile.displayName}${desiredProfile.role ? `，角色：${desiredProfile.role}` : ''}`;
    const instruction = createInstruction(input, desiredProfile.agentId);
    const pendingProfile = {
      ...upsertAgentProfile(teamProfile, desiredProfile),
      instructions: [instruction, ...teamProfile.instructions],
    };
    await persistProfile(pendingProfile);
    const actionRun = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: currentInstanceId,
      agentId: agents.find((agent) => agent.default)?.id || agents[0]?.id || 'main',
      input,
      executionMode: 'isolated-session',
    });
    actionRun.targetAgentId = desiredProfile.agentId;
    await upsertActionRun({ ...actionRun, status: 'planning', updatedAt: Date.now() });
    try {
      const updatedRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: '创建 Gateway Agent',
        prompt: buildGatewayAgentCreatePrompt({ input, profile: desiredProfile }),
      });
      await upsertActionRun(updatedRun);
      useStore.getState().fetchSessions();
      useStore.getState().fetchAgents();
      setQuickDraft({ displayName: '', role: '', personality: '' });
      setQuickModalVisible(false);
      Toast.success('已提交到 Gateway 创建 Agent');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Gateway 执行失败';
      await persistProfile(markAgentProfileBindingFailed(pendingProfile, desiredProfile.agentId, error));
      await upsertActionRun({
        ...actionRun,
        status: 'failed',
        error,
        updatedAt: Date.now(),
      });
      Toast.error(error);
    } finally {
      setActionSubmitting(false);
    }
  }, [
    activeClient,
    agents,
    connectionStatus,
    currentInstanceId,
    persistProfile,
    quickDraft,
    teamProfile,
    upsertActionRun,
  ]);

  const renderOverview = () => {
    if (!selectedMember) return <Empty description="请选择 Agent" />;
    const agent = selectedMember.agent;
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Descriptions
          data={[
            { key: 'Agent ID', value: agent.id },
            { key: 'Identity 名称', value: agent.identity?.name || '—' },
            { key: 'Identity Emoji', value: agent.identity?.emoji || '—' },
            { key: 'Identity Avatar', value: agent.identity?.avatar || '—' },
            { key: 'Avatar 状态', value: agent.identity?.avatarStatus || '—' },
            { key: '来源', value: selectedMember.source === 'gateway' ? 'OpenClaw Gateway' : '本地草稿' },
            { key: '状态', value: getAgentStatusLabel(agent.status) },
            { key: '会话数', value: String(agent.sessionCount ?? 0) },
            { key: 'Workspace', value: agent.workspace || '—' },
            { key: 'Model', value: agentModelString(agent.model) || '—' },
            { key: 'Thinking', value: String(agent.thinking || '—') },
          ]}
          row
          size="small"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <div style={TEAM_PANEL_STYLE}>
            <div style={{ padding: 14 }}>
              <Text type="tertiary" size="small">
                角色
              </Text>
              <Text strong style={{ display: 'block', marginTop: 6 }}>
                {selectedMember.profile.role || '待补充'}
              </Text>
            </div>
          </div>
          <div style={TEAM_PANEL_STYLE}>
            <div style={{ padding: 14 }}>
              <Text type="tertiary" size="small">
                办公室头衔
              </Text>
              <Text strong style={{ display: 'block', marginTop: 6 }}>
                {selectedMember.profile.officeTitle || 'Agent'}
              </Text>
            </div>
          </div>
          <div style={TEAM_PANEL_STYLE}>
            <div style={{ padding: 14 }}>
              <Text type="tertiary" size="small">
                办公室区域
              </Text>
              <Text strong style={{ display: 'block', marginTop: 6 }}>
                {selectedMember.profile.officeZone || 'work'}
              </Text>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfileEditor = () => (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Input
          prefix={<IconServer />}
          placeholder="展示名称"
          value={currentProfileDraft.displayName}
          onChange={(value) => updateCurrentProfileDraft({ displayName: value })}
        />
        <Input
          prefix={<IconAppCenter />}
          placeholder="角色 / 职责"
          value={currentProfileDraft.role}
          onChange={(value) => updateCurrentProfileDraft({ role: value })}
        />
        <Input
          prefix={<IconUserGroup />}
          placeholder="办公室头衔"
          value={currentProfileDraft.officeTitle}
          onChange={(value) => updateCurrentProfileDraft({ officeTitle: value })}
        />
        <Select
          value={currentProfileDraft.officeZone}
          onChange={(value) => updateCurrentProfileDraft({ officeZone: String(value) as AgentOfficeZone })}
        >
          <Select.Option value="work">工作区</Select.Option>
          <Select.Option value="meeting">会议区</Select.Option>
          <Select.Option value="lounge">休闲区</Select.Option>
        </Select>
      </div>

      <TextArea
        placeholder="人格：这个 Agent 的沟通风格、偏好和边界"
        rows={3}
        value={currentProfileDraft.personality}
        onChange={(value) => updateCurrentProfileDraft({ personality: value })}
      />
      <TextArea
        placeholder="认知：它看问题的原则、方法论和判断标准"
        rows={3}
        value={currentProfileDraft.cognition}
        onChange={(value) => updateCurrentProfileDraft({ cognition: value })}
      />
      <TextArea
        placeholder="记忆摘要：长期职责、重要偏好、已知上下文"
        rows={3}
        value={currentProfileDraft.memorySummary}
        onChange={(value) => updateCurrentProfileDraft({ memorySummary: value })}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Text type="tertiary" size="small">
          颜色
        </Text>
        {PROFILE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => updateCurrentProfileDraft({ color })}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              border:
                currentProfileDraft.color === color ? '2px solid var(--semi-color-text-0)' : '1px solid transparent',
              background: color,
              cursor: 'pointer',
            }}
          />
        ))}
        <Button icon={<IconSave />} type="primary" theme="solid" onClick={handleSaveProfile}>
          保存画像
        </Button>
      </div>
    </div>
  );

  const renderFiles = () => {
    if (!selectedMember) return <Empty description="请选择 Agent" />;
    if (selectedMember.source === 'local') {
      return <Empty description="本地草稿 Agent 尚未接入 Gateway，暂无远端文件" />;
    }
    return (
      <AgentFilesPanel
        key={selectedMember.agent.id}
        agentId={selectedMember.agent.id}
        client={activeClient}
        isConnected={isConnected}
      />
    );
  };

  const renderInstructions = () => (
    <div style={{ display: 'grid', gap: 10 }}>
      {teamProfile.instructions.length === 0 ? (
        <Empty description="还没有自然语言编排记录" />
      ) : (
        teamProfile.instructions.map((instruction) => (
          <div key={instruction.id} style={{ ...TEAM_PANEL_STYLE, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <Text strong>{instruction.summary || '团队编排草稿'}</Text>
              <Tag
                color={instruction.status === 'applied' ? 'green' : instruction.status === 'failed' ? 'red' : 'orange'}
                size="small"
              >
                {instruction.status === 'applied'
                  ? '已绑定'
                  : instruction.status === 'failed'
                    ? '失败'
                    : instruction.status === 'pending'
                      ? '待绑定'
                      : '草稿'}
              </Tag>
            </div>
            <Text style={{ display: 'block', marginTop: 8, whiteSpace: 'pre-wrap' }}>{instruction.text}</Text>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
              {formatTime(instruction.createdAt)}
              {instruction.agentId ? ` · ${instruction.agentId}` : ''}
            </Text>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 18,
          gap: 16,
        }}
      >
        <div>
          <Title heading={3} style={{ margin: 0 }}>
            Agents
          </Title>
          <Text type="tertiary">{t('page.teamsDesc')} · 虚拟公司与 Agent 本地画像</Text>
        </div>
        <Space>
          <Button icon={<IconRefresh />} onClick={handleRefresh} loading={refreshing}>
            刷新
          </Button>
          <Button icon={<IconSend />} onClick={() => setComposerModalVisible(true)}>
            自然语言编排
          </Button>
          <Button icon={<IconPlus />} type="primary" theme="solid" onClick={() => setQuickModalVisible(true)}>
            创建 Agent
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Tag color="blue">{members.length} 个团队成员</Tag>
        <Tag color="green">{gatewayAgentCount} 个 Gateway Agent</Tag>
        <Tag color="orange">{pendingProfileCount} 个待绑定本地画像</Tag>
        {failedProfileCount > 0 && <Tag color="red">{failedProfileCount} 个绑定失败画像</Tag>}
        <Tag color={isConnected ? 'green' : 'grey'}>{isConnected ? 'Gateway 已连接' : 'Gateway 未连接'}</Tag>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin size="large" tip="加载团队资料..." />
        </div>
      ) : members.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description="还没有从 Gateway 读取到 Agent">
            <Button type="primary" theme="solid" onClick={() => setQuickModalVisible(true)}>
              创建 Gateway Agent
            </Button>
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {members.map((member) => (
              <AgentRosterItem
                key={member.agent.id}
                member={member}
                selected={selectedMember?.agent.id === member.agent.id}
                onSelect={() => handleSelectAgent(member.agent.id)}
              />
            ))}
          </div>

          <Card style={TEAM_PANEL_STYLE} bodyStyle={{ padding: 18 }}>
            {selectedMember ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: `${selectedMember.profile.color ?? PROFILE_COLORS[0]}1f`,
                        color: selectedMember.profile.color ?? PROFILE_COLORS[0],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconServer size="large" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Title heading={4} style={{ margin: 0 }} ellipsis>
                        {selectedMember.profile.displayName ||
                          agentNameString(selectedMember.agent.name) ||
                          selectedMember.agent.id}
                      </Title>
                      <Text type="tertiary" ellipsis style={{ display: 'block' }}>
                        {selectedMember.profile.role || selectedMember.agent.id}
                      </Text>
                    </div>
                  </div>
                  <Space>
                    {selectedMember.agent.default && <Tag color="blue">Default</Tag>}
                    <Tag
                      color={
                        selectedMember.source === 'local' ? 'blue' : getAgentStatusColor(selectedMember.agent.status)
                      }
                    >
                      {selectedMember.source === 'local'
                        ? 'local draft'
                        : getAgentStatusLabel(selectedMember.agent.status)}
                    </Tag>
                  </Space>
                </div>

                <Tabs style={{ marginTop: 16 }}>
                  <Tabs.TabPane
                    tab={
                      <span>
                        <IconBulb /> 概览
                      </span>
                    }
                    itemKey="overview"
                  >
                    {renderOverview()}
                  </Tabs.TabPane>
                  <Tabs.TabPane
                    tab={
                      <span>
                        <IconEdit /> 本地画像
                      </span>
                    }
                    itemKey="profile"
                  >
                    {renderProfileEditor()}
                  </Tabs.TabPane>
                  <Tabs.TabPane
                    tab={
                      <span>
                        <IconFile /> Agent 文件
                      </span>
                    }
                    itemKey="files"
                  >
                    {renderFiles()}
                  </Tabs.TabPane>
                  <Tabs.TabPane
                    tab={
                      <span>
                        <IconBox /> 编排记录
                      </span>
                    }
                    itemKey="instructions"
                  >
                    {renderInstructions()}
                  </Tabs.TabPane>
                </Tabs>
              </>
            ) : (
              <Empty description="请选择 Agent" />
            )}
          </Card>
        </div>
      )}

      <Modal
        title="自然语言编排 Agent 团队"
        visible={composerModalVisible}
        onCancel={() => setComposerModalVisible(false)}
        onOk={handleCompose}
        okText="提交 Gateway"
        cancelText="取消"
        confirmLoading={actionSubmitting}
        width={680}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <TextArea
            rows={6}
            value={composerText}
            onChange={setComposerText}
            placeholder="例如：新增一个产品 Agent，角色：负责把用户想法整理成规格；性格：温和但会追问关键约束"
          />
          <Text type="tertiary" size="small">
            将创建 ActionRun，并在隔离 Gateway 会话中调用 OpenClaw 执行；本地仅保存职位、称呼、办公室区域等扩展画像。
          </Text>
        </div>
      </Modal>

      <Modal
        title="创建 Gateway Agent"
        visible={quickModalVisible}
        onCancel={() => setQuickModalVisible(false)}
        onOk={handleQuickAdd}
        okText="提交 Gateway"
        cancelText="取消"
        confirmLoading={actionSubmitting}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input
            prefix={<IconServer />}
            placeholder="Agent 名称"
            value={quickDraft.displayName}
            onChange={(value) => setQuickDraft((draft) => ({ ...draft, displayName: value }))}
          />
          <Input
            prefix={<IconAppCenter />}
            placeholder="角色 / 职责"
            value={quickDraft.role}
            onChange={(value) => setQuickDraft((draft) => ({ ...draft, role: value }))}
          />
          <TextArea
            rows={3}
            placeholder="人格摘要"
            value={quickDraft.personality}
            onChange={(value) => setQuickDraft((draft) => ({ ...draft, personality: value }))}
          />
          <Text type="tertiary" size="small">
            Desktop 会把这些资料作为本地扩展画像保存，并通过 AI Action Center 提交 Gateway 创建真实 Agent。
          </Text>
        </div>
      </Modal>
    </div>
  );
}
