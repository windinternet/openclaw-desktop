import { useState, useCallback, useEffect, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
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
import { useWorkbenchWorkItemOptions } from '../lib/workbench-work-items';
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

interface EmbeddedPageProps {
  embedded?: boolean;
  onHeaderActionsChange?: (actions: ReactNode | null) => void;
}

export default function TeamsPage({ embedded = false, onHeaderActionsChange }: EmbeddedPageProps = {}) {
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
  const {
    loading: teamWorkItemLoading,
    options: teamWorkItemOptions,
    selectedPath: selectedTeamWorkItemPath,
    setSelectedPath: setSelectedTeamWorkItemPath,
    selectedWorkItem: selectedTeamWorkItem,
    selectedWorkItemId: selectedTeamWorkItemId,
  } = useWorkbenchWorkItemOptions({
    instanceId: currentInstanceId,
    enabled: composerModalVisible || quickModalVisible,
  });

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
      Toast.success(t('teams.agentsRefreshed'));
    } catch {
      Toast.error(t('teams.agentsRefreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

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
    Toast.success(t('teams.profileSaved'));
  }, [currentProfileDraft, persistProfile, selectedMember, teamProfile, t]);

  const handleCompose = useCallback(async () => {
    const text = composerText.trim();
    if (!text) {
      Toast.warning(t('teams.composeFirst'));
      return;
    }
    if (!currentInstanceId) {
      Toast.error(t('teams.noInstance'));
      return;
    }
    if (!activeClient || connectionStatus !== 'connected') {
      Toast.error(t('teams.notConnectedGatewayCompose'));
      return;
    }

    setActionSubmitting(true);
    const createsAgent = shouldCreateAgentFromInstruction(text);
    const resolvedWorkItemPath = selectedTeamWorkItem?.path;
    const resolvedWorkItemId = selectedTeamWorkItemId;
    const baseActionRun = createAiActionRun({
      type: createsAgent ? 'gateway_agent_create' : 'agent_team_compose',
      sourcePage: 'teams',
      instanceId: currentInstanceId,
      agentId: selectedMember?.agent.id || agents.find((agent) => agent.default)?.id || agents[0]?.id || 'main',
      input: text,
      executionMode: 'isolated-session',
      workItemId: resolvedWorkItemId,
      workItemPath: resolvedWorkItemPath,
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
        title: createsAgent ? t('actions.typeGatewayCreate') : t('actions.typeTeamCompose'),
        prompt: createsAgent
          ? buildGatewayAgentCreatePrompt({ input: text, profile: desiredProfile })
          : buildAgentTeamComposePrompt({ input: text, profile: desiredProfile }),
      });
      await upsertActionRun(updatedRun);
      useStore.getState().fetchSessions();
      Toast.success(t('teams.submittedToGateway'));
      setComposerText('');
      setComposerModalVisible(false);
    } catch (err) {
      const error = err instanceof Error ? err.message : t('teams.gatewayExecFailed');
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
    selectedTeamWorkItem,
    selectedTeamWorkItemId,
    teamProfile,
    upsertActionRun,
    t,
  ]);

  const handleQuickAdd = useCallback(async () => {
    if (!quickDraft.displayName.trim()) {
      Toast.warning(t('teams.fillAgentName'));
      return;
    }
    if (!currentInstanceId) {
      Toast.error(t('teams.noInstance'));
      return;
    }
    if (!activeClient || connectionStatus !== 'connected') {
      Toast.error(t('teams.notConnectedGatewayCreate'));
      return;
    }

    setActionSubmitting(true);
    const desiredProfile = buildQuickAgentProfile(quickDraft, teamProfile);
    const resolvedWorkItemPath = selectedTeamWorkItem?.path;
    const resolvedWorkItemId = selectedTeamWorkItemId;
    const input = `${t('teams.createAgentTitle')}：${desiredProfile.displayName}${desiredProfile.role ? `，${t('teams.role')}：${desiredProfile.role}` : ''}`;
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
      workItemId: resolvedWorkItemId,
      workItemPath: resolvedWorkItemPath,
    });
    actionRun.targetAgentId = desiredProfile.agentId;
    await upsertActionRun({ ...actionRun, status: 'planning', updatedAt: Date.now() });
    try {
      const updatedRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: t('actions.typeGatewayCreate'),
        prompt: buildGatewayAgentCreatePrompt({ input, profile: desiredProfile }),
      });
      await upsertActionRun(updatedRun);
      useStore.getState().fetchSessions();
      useStore.getState().fetchAgents();
      setQuickDraft({ displayName: '', role: '', personality: '' });
      setQuickModalVisible(false);
      Toast.success(t('teams.submittedCreateAgent'));
    } catch (err) {
      const error = err instanceof Error ? err.message : t('teams.gatewayExecFailed');
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
    selectedTeamWorkItem,
    selectedTeamWorkItemId,
    teamProfile,
    upsertActionRun,
    t,
  ]);

  const renderActionWorkItemPicker = () =>
    teamWorkItemOptions.length > 0 ? (
      <div style={{ display: 'grid', gap: 6 }}>
        <Text type="tertiary" size="small">
          {t('teams.actionWorkItemDesc')}
        </Text>
        <Select
          value={selectedTeamWorkItemPath}
          placeholder={t('teams.actionWorkItemPlaceholder')}
          onChange={(value) => setSelectedTeamWorkItemPath(String(value))}
          loading={teamWorkItemLoading}
          disabled={actionSubmitting}
          style={{ width: '100%' }}
        >
          {teamWorkItemOptions.map((item) => (
            <Select.Option key={item.path} value={item.path}>
              {item.name} · {item.path}
            </Select.Option>
          ))}
        </Select>
      </div>
    ) : null;

  const renderOverview = () => {
    if (!selectedMember) return <Empty description={t('teams.selectAgent')} />;
    const agent = selectedMember.agent;
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Descriptions
          data={[
            { key: 'Agent ID', value: agent.id },
            { key: t('teams.fieldIdentityName'), value: agent.identity?.name || '—' },
            { key: 'Identity Emoji', value: agent.identity?.emoji || '—' },
            { key: 'Identity Avatar', value: agent.identity?.avatar || '—' },
            { key: t('teams.fieldAvatarStatus'), value: agent.identity?.avatarStatus || '—' },
            {
              key: t('teams.fieldSource'),
              value: selectedMember.source === 'gateway' ? t('teams.openclawGateway') : t('teams.localDraft'),
            },
            { key: t('teams.fieldStatus'), value: getAgentStatusLabel(agent.status) },
            { key: t('teams.fieldSessionCount'), value: String(agent.sessionCount ?? 0) },
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
                {t('teams.fieldProfileRole')}
              </Text>
              <Text strong style={{ display: 'block', marginTop: 6 }}>
                {selectedMember.profile.role || t('teams.toFill')}
              </Text>
            </div>
          </div>
          <div style={TEAM_PANEL_STYLE}>
            <div style={{ padding: 14 }}>
              <Text type="tertiary" size="small">
                {t('teams.fieldProfileOfficeTitle')}
              </Text>
              <Text strong style={{ display: 'block', marginTop: 6 }}>
                {selectedMember.profile.officeTitle || 'Agent'}
              </Text>
            </div>
          </div>
          <div style={TEAM_PANEL_STYLE}>
            <div style={{ padding: 14 }}>
              <Text type="tertiary" size="small">
                {t('teams.fieldProfileOfficeZone')}
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
          placeholder={t('teams.displayName')}
          value={currentProfileDraft.displayName}
          onChange={(value) => updateCurrentProfileDraft({ displayName: value })}
        />
        <Input
          prefix={<IconAppCenter />}
          placeholder={t('teams.role')}
          value={currentProfileDraft.role}
          onChange={(value) => updateCurrentProfileDraft({ role: value })}
        />
        <Input
          prefix={<IconUserGroup />}
          placeholder={t('teams.officeTitle')}
          value={currentProfileDraft.officeTitle}
          onChange={(value) => updateCurrentProfileDraft({ officeTitle: value })}
        />
        <Select
          value={currentProfileDraft.officeZone}
          onChange={(value) => updateCurrentProfileDraft({ officeZone: String(value) as AgentOfficeZone })}
        >
          <Select.Option value="work">{t('office.zoneWork')}</Select.Option>
          <Select.Option value="meeting">{t('office.zoneMeeting')}</Select.Option>
          <Select.Option value="lounge">{t('office.zoneLounge')}</Select.Option>
        </Select>
      </div>

      <TextArea
        placeholder={t('teams.personalityPlaceholder')}
        rows={3}
        value={currentProfileDraft.personality}
        onChange={(value) => updateCurrentProfileDraft({ personality: value })}
      />
      <TextArea
        placeholder={t('teams.cognitionPlaceholder')}
        rows={3}
        value={currentProfileDraft.cognition}
        onChange={(value) => updateCurrentProfileDraft({ cognition: value })}
      />
      <TextArea
        placeholder={t('teams.memoryPlaceholder')}
        rows={3}
        value={currentProfileDraft.memorySummary}
        onChange={(value) => updateCurrentProfileDraft({ memorySummary: value })}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Text type="tertiary" size="small">
          {t('teams.color')}
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
          {t('teams.saveProfile')}
        </Button>
      </div>
    </div>
  );

  const renderFiles = () => {
    if (!selectedMember) return <Empty description={t('teams.selectAgent')} />;
    if (selectedMember.source === 'local') {
      return <Empty description={t('teams.localDraftNoFiles')} />;
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
        <Empty description={t('teams.noInstructions')} />
      ) : (
        teamProfile.instructions.map((instruction) => (
          <div key={instruction.id} style={{ ...TEAM_PANEL_STYLE, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <Text strong>{instruction.summary || t('teams.draft')}</Text>
              <Tag
                color={instruction.status === 'applied' ? 'green' : instruction.status === 'failed' ? 'red' : 'orange'}
                size="small"
              >
                {instruction.status === 'applied'
                  ? t('teams.statusApplied')
                  : instruction.status === 'failed'
                    ? t('teams.statusFailed')
                    : instruction.status === 'pending'
                      ? t('teams.statusPending')
                      : t('teams.statusDraft')}
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

  const headerActions = useMemo(
    () => (
      <Space>
        <Button icon={<IconRefresh />} onClick={handleRefresh} loading={refreshing}>
          {t('common.refresh')}
        </Button>
        <Button icon={<IconSend />} onClick={() => setComposerModalVisible(true)}>
          {t('teams.compose')}
        </Button>
        <Button icon={<IconPlus />} type="primary" theme="solid" onClick={() => setQuickModalVisible(true)}>
          {t('teams.createAgent')}
        </Button>
      </Space>
    ),
    [handleRefresh, refreshing, t],
  );

  useEffect(() => {
    if (!embedded) return undefined;
    onHeaderActionsChange?.(headerActions);
    return () => onHeaderActionsChange?.(null);
  }, [embedded, headerActions, onHeaderActionsChange]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: embedded ? '12px 0 0' : 24 }}>
      {!embedded && (
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
              {t('teams.title')}
            </Title>
            <Text type="tertiary">
              {t('page.teamsDesc')} · {t('teams.subtitle')}
            </Text>
          </div>
          {headerActions}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Tag color="blue">{t('teams.nMembers', { count: members.length })}</Tag>
        <Tag color="green">{t('teams.nGatewayAgents', { count: gatewayAgentCount })}</Tag>
        <Tag color="orange">{t('teams.nPendingProfiles', { count: pendingProfileCount })}</Tag>
        {failedProfileCount > 0 && <Tag color="red">{t('teams.nFailedProfiles', { count: failedProfileCount })}</Tag>}
        <Tag color={isConnected ? 'green' : 'grey'}>
          {isConnected ? t('teams.gatewayConnected') : t('teams.gatewayNotConnected')}
        </Tag>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin size="large" tip={t('teams.loading')} />
        </div>
      ) : members.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description={t('teams.empty')}>
            <Button type="primary" theme="solid" onClick={() => setQuickModalVisible(true)}>
              {t('teams.createAgent')}
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
                    {selectedMember.agent.default && <Tag color="blue">{t('teams.default')}</Tag>}
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
                        <IconBulb /> {t('teams.overview')}
                      </span>
                    }
                    itemKey="overview"
                  >
                    {renderOverview()}
                  </Tabs.TabPane>
                  <Tabs.TabPane
                    tab={
                      <span>
                        <IconEdit /> {t('teams.profile')}
                      </span>
                    }
                    itemKey="profile"
                  >
                    {renderProfileEditor()}
                  </Tabs.TabPane>
                  <Tabs.TabPane
                    tab={
                      <span>
                        <IconFile /> {t('teams.agentFiles')}
                      </span>
                    }
                    itemKey="files"
                  >
                    {renderFiles()}
                  </Tabs.TabPane>
                  <Tabs.TabPane
                    tab={
                      <span>
                        <IconBox /> {t('teams.instructions')}
                      </span>
                    }
                    itemKey="instructions"
                  >
                    {renderInstructions()}
                  </Tabs.TabPane>
                </Tabs>
              </>
            ) : (
              <Empty description={t('teams.selectAgent')} />
            )}
          </Card>
        </div>
      )}

      <Modal
        title={t('teams.composeTitle')}
        visible={composerModalVisible}
        onCancel={() => setComposerModalVisible(false)}
        onOk={handleCompose}
        okText={t('teams.submitToGateway')}
        cancelText={t('common.cancel')}
        confirmLoading={actionSubmitting}
        width={680}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <TextArea
            rows={6}
            value={composerText}
            onChange={setComposerText}
            placeholder={t('teams.composePlaceholder')}
          />
          <Text type="tertiary" size="small">
            {t('teams.composeDesc')}
          </Text>
          {renderActionWorkItemPicker()}
        </div>
      </Modal>

      <Modal
        title={t('teams.createAgentTitle')}
        visible={quickModalVisible}
        onCancel={() => setQuickModalVisible(false)}
        onOk={handleQuickAdd}
        okText={t('teams.submitToGateway')}
        cancelText={t('common.cancel')}
        confirmLoading={actionSubmitting}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input
            prefix={<IconServer />}
            placeholder={t('teams.agentName')}
            value={quickDraft.displayName}
            onChange={(value) => setQuickDraft((draft) => ({ ...draft, displayName: value }))}
          />
          <Input
            prefix={<IconAppCenter />}
            placeholder={t('teams.role')}
            value={quickDraft.role}
            onChange={(value) => setQuickDraft((draft) => ({ ...draft, role: value }))}
          />
          <TextArea
            rows={3}
            placeholder={t('teams.personality')}
            value={quickDraft.personality}
            onChange={(value) => setQuickDraft((draft) => ({ ...draft, personality: value }))}
          />
          <Text type="tertiary" size="small">
            {t('teams.createAgentDesc')}
          </Text>
          {renderActionWorkItemPicker()}
        </div>
      </Modal>
    </div>
  );
}
