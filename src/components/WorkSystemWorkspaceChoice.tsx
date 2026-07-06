import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Input, Modal, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBranch, IconCloud, IconFolderOpen, IconForward, IconPlusCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  createAiActionRunWithWorkItemAssignment,
  executeAiActionRunWithGateway,
  syncAiActionRunWithGateway,
  useStore,
} from '../lib';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type { RepositoryBinding, RepositoryStatus, WorkbenchSemanticMapping } from '../lib/agentic-repository';
import {
  adaptRepositoryBinding,
  bootstrapRepositoryBinding,
  createAndSaveRepositoryBinding,
  inspectRepositoryBinding,
  loadRepositoryBinding,
  saveRepositoryBinding,
  type RepositoryInspectDetails,
} from '../lib/agentic-repository-store';
import {
  buildWorkbenchRepositorySetupFeedback,
  buildWorkbenchSemanticMappingPrompt,
  buildWorkbenchStructureSignals,
  parseWorkbenchSemanticMappingResponse,
  sanitizeWorkbenchSemanticMapping,
} from '../lib/repository-workbench-mapping';

const { Text } = Typography;

type WorkspaceChoice = 'create' | 'existing';
type WorkspaceHostTarget = 'desktop' | 'gateway';

interface WorkspaceChoiceProps {
  firstMatterDraft: string;
  firstMatterCreating: boolean;
  onFirstMatterDraftChange: (value: string) => void;
  onCreateFirstMatter: (binding: RepositoryBinding) => void;
  onSkipWorkspace: () => void;
}

export default function WorkSystemWorkspaceChoice({
  firstMatterDraft,
  firstMatterCreating,
  onFirstMatterDraftChange,
  onCreateFirstMatter,
  onSkipWorkspace,
}: WorkspaceChoiceProps) {
  const { t } = useTranslation();
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const currentInstance = useStore((s) => s.instances.find((instance) => instance.id === s.currentInstanceId) ?? null);
  const activeClient = useStore((s) => s.activeClient);
  const agents = useStore((s) => s.agents);
  const [activeChoice, setActiveChoice] = useState<WorkspaceChoice | null>(null);
  const [workspaceHostTarget, setWorkspaceHostTarget] = useState<WorkspaceHostTarget>('desktop');
  const [gatewayRepoPath, setGatewayRepoPath] = useState('~/OpenClaw/Agentic Repository');
  const [binding, setBinding] = useState<RepositoryBinding | null>(null);
  const [status, setStatus] = useState<RepositoryStatus>('repo_unbound');
  const [inspectDetails, setInspectDetails] = useState<RepositoryInspectDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [mappingLoading, setMappingLoading] = useState(false);

  const gatewayRunsOnDesktopHost = useMemo(
    () => isLocalGatewayUrl(currentInstance?.gatewayUrl),
    [currentInstance?.gatewayUrl],
  );
  const selectedHostTarget = gatewayRunsOnDesktopHost ? 'desktop' : workspaceHostTarget;
  const selectedLocation: RepositoryBinding['location'] =
    selectedHostTarget === 'desktop' ? 'desktop-local' : 'gateway-local';
  const selectedBinding = binding?.location === selectedLocation ? binding : null;
  const selectedStatus = selectedBinding ? status : 'repo_unbound';
  const ready = Boolean(
    selectedBinding && (selectedStatus === 'repo_ready' || selectedBinding.workbench?.isWorkbenchRepository),
  );
  const setupFeedback = buildWorkbenchRepositorySetupFeedback({
    status: selectedStatus,
    binding: selectedBinding,
    missingRecommendedEntries: inspectDetails?.missingTemplateEntries,
  });

  useEffect(() => {
    let cancelled = false;
    if (!currentInstanceId) {
      setBinding(null);
      setStatus('repo_unbound');
      setInspectDetails(null);
      return;
    }
    loadRepositoryBinding(currentInstanceId).then((stored) => {
      if (cancelled || !stored) return;
      setBinding(stored);
      setStatus(stored.status);
    });
    return () => {
      cancelled = true;
    };
  }, [currentInstanceId]);

  const inspectAndStore = useCallback(async (nextBinding: RepositoryBinding) => {
    const result = await inspectRepositoryBinding(nextBinding);
    setBinding(result.binding);
    setStatus(result.status);
    setInspectDetails(result.details);
    await saveRepositoryBinding(result.binding);
    return result;
  }, []);

  const saveWorkbenchMapping = useCallback(async (base: RepositoryBinding, mapping: WorkbenchSemanticMapping) => {
    const next: RepositoryBinding = {
      ...base,
      schemaProfile: base.schemaProfile === 'default' ? 'semantic-workbench' : base.schemaProfile,
      workbench: mapping,
    };
    setBinding(next);
    await saveRepositoryBinding(next);
    return next;
  }, []);

  const chooseDesktopDirectory = async () => {
    const selected = await window.electronAPI?.repository?.chooseDirectory?.();
    return selected?.trim() || null;
  };

  const createDesktopRepository = async () => {
    if (!currentInstanceId) return;
    const selected = await chooseDesktopDirectory();
    if (!selected) return;
    setLoading(true);
    try {
      const next = await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: selected,
        location: 'desktop-local',
      });
      const result = await bootstrapRepositoryBinding(next);
      setBinding(result.binding);
      setStatus(result.status);
      setInspectDetails(result.details);
      await saveRepositoryBinding(result.binding);
      Toast.success(t('dashboard.workspaceCreateDone'));
    } finally {
      setLoading(false);
    }
  };

  const bindDesktopRepository = async () => {
    if (!currentInstanceId) return;
    const selected = await chooseDesktopDirectory();
    if (!selected) return;
    setLoading(true);
    try {
      const next = await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: selected,
        location: 'desktop-local',
      });
      await inspectAndStore(next);
      Toast.success(t('dashboard.workspaceBindInspected'));
    } finally {
      setLoading(false);
    }
  };

  const bindGatewayRepositoryPath = async (mode: WorkspaceChoice) => {
    if (!currentInstanceId) return;
    const path = gatewayRepoPath.trim();
    if (!path) {
      Toast.warning(t('dashboard.workspaceGatewayPathRequired'));
      return;
    }
    setLoading(true);
    try {
      const next = await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: path,
        location: 'gateway-local',
      });
      await inspectAndStore(next);
      Toast.info(
        mode === 'create' ? t('dashboard.workspaceGatewayCreateRecorded') : t('dashboard.workspaceGatewayBindRecorded'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSemanticWorkbenchMapping = async () => {
    if (!currentInstanceId || !binding) return;
    if (!activeClient) {
      Toast.error(t('repositoryGate.mappingNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('repositoryGate.mappingNoAgent'));
      return;
    }
    if (binding.location !== 'desktop-local') {
      Toast.warning(t('dashboard.workspaceGatewaySemanticUnavailable'));
      return;
    }
    const repository = window.electronAPI?.repository;
    if (!repository?.listTree) {
      Toast.error(t('repositoryGate.localRepositoryUnavailable'));
      return;
    }

    setMappingLoading(true);
    try {
      const tree = await repository.listTree(binding.repoPath, 400);
      const structureSignals = buildWorkbenchStructureSignals(tree);
      const run = createAiActionRunWithWorkItemAssignment({
        type: 'workbench_repository_map',
        sourcePage: 'workbench',
        instanceId: currentInstanceId,
        agentId: agent.id,
        executionMode: 'isolated-session',
        input: t('repositoryGate.workbenchMappingActionInput', { path: binding.repoPath }),
      });
      await upsertAiActionRun(currentInstanceId, { ...run, status: 'planning', updatedAt: Date.now() });
      const running = await executeAiActionRunWithGateway(activeClient, run, {
        title: t('repositoryGate.workbenchMappingActionTitle'),
        prompt: buildWorkbenchSemanticMappingPrompt({ repoPath: binding.repoPath, tree, structureSignals }),
      });
      await upsertAiActionRun(currentInstanceId, running);

      let latest = running;
      for (let index = 0; index < 10; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latest = await syncAiActionRunWithGateway(activeClient, latest);
        await upsertAiActionRun(currentInstanceId, latest);
        if (latest.status === 'done' || latest.status === 'failed' || latest.status === 'cancelled') break;
      }

      const parsed = parseWorkbenchSemanticMappingResponse(latest.lastAssistantResponse ?? '');
      const sanitized = parsed?.mapping ? sanitizeWorkbenchSemanticMapping({ mapping: parsed.mapping, tree }) : null;
      if (!parsed?.isWorkbenchRepository || !sanitized) {
        Toast.error(parsed?.reason || t('repositoryGate.workbenchMappingFailed'));
        return;
      }
      const next = await saveWorkbenchMapping(binding, sanitized);
      await inspectAndStore(next);
      Toast.success(t('repositoryGate.workbenchMappingSaved'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('repositoryGate.workbenchMappingFailed'));
    } finally {
      setMappingLoading(false);
    }
  };

  const approveAdaptation = () => {
    if (!binding) return;
    Modal.confirm({
      title: t('repositoryGate.adaptationConfirmTitle'),
      content: (
        <Space vertical align="start">
          <Text>{t('repositoryGate.adaptationConfirmDesc')}</Text>
          <Text size="small">{t('repositoryGate.adaptationSafety')}</Text>
        </Space>
      ),
      okText: t('repositoryGate.approveAdaptation'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setLoading(true);
        try {
          const result = await adaptRepositoryBinding(binding);
          setBinding(result.binding);
          setStatus(result.status);
          setInspectDetails(result.details);
          await saveRepositoryBinding(result.binding);
          Toast.success(t('repositoryGate.adaptationDone'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <div className="dashboard-workspace-choice">
      <div className="dashboard-workspace-choice-grid">
        <WorkspaceChoiceCard
          icon={<IconForward />}
          title={t('dashboard.workspaceChoiceSkip')}
          description={t('dashboard.workspaceChoiceSkipDesc')}
          actionLabel={t('dashboard.workspaceChoiceSkipAction')}
          onAction={onSkipWorkspace}
        />
        <WorkspaceChoiceCard
          icon={<IconPlusCircle />}
          title={t('dashboard.workspaceChoiceCreate')}
          description={t('dashboard.workspaceChoiceCreateDesc')}
          actionLabel={t('dashboard.workspaceChoiceCreateAction')}
          selected={activeChoice === 'create'}
          onAction={() => setActiveChoice('create')}
        />
        <WorkspaceChoiceCard
          icon={<IconFolderOpen />}
          title={t('dashboard.workspaceChoiceBind')}
          description={t('dashboard.workspaceChoiceBindDesc')}
          actionLabel={t('dashboard.workspaceChoiceBindAction')}
          selected={activeChoice === 'existing'}
          onAction={() => setActiveChoice('existing')}
        />
      </div>
      {activeChoice ? (
        <div className="dashboard-onboarding-repository">
          <div className="dashboard-workspace-flow">
            <WorkspaceHostSelector
              hidden={gatewayRunsOnDesktopHost}
              workspaceHostTarget={workspaceHostTarget}
              onChange={setWorkspaceHostTarget}
            />
            {selectedHostTarget === 'desktop' ? (
              <DesktopRepositoryFlow
                mode={activeChoice}
                loading={loading}
                disabled={!currentInstanceId}
                binding={selectedBinding}
                status={selectedStatus}
                setupFeedbackKind={setupFeedback.kind}
                onCreateRepository={createDesktopRepository}
                onBindRepository={bindDesktopRepository}
                onSemanticMapping={handleSemanticWorkbenchMapping}
                onApproveAdaptation={approveAdaptation}
                mappingLoading={mappingLoading}
              />
            ) : (
              <GatewayRepositoryFlow
                mode={activeChoice}
                loading={loading}
                disabled={!currentInstanceId}
                path={gatewayRepoPath}
                binding={selectedBinding}
                status={selectedStatus}
                onPathChange={setGatewayRepoPath}
                onSubmit={() => bindGatewayRepositoryPath(activeChoice)}
              />
            )}
            {ready && selectedBinding ? (
              <RepositoryReadyPanel
                binding={selectedBinding}
                firstMatterDraft={firstMatterDraft}
                firstMatterCreating={firstMatterCreating}
                onFirstMatterDraftChange={onFirstMatterDraftChange}
                onCreateFirstMatter={onCreateFirstMatter}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceHostSelector({
  hidden,
  workspaceHostTarget,
  onChange,
}: {
  hidden: boolean;
  workspaceHostTarget: WorkspaceHostTarget;
  onChange: (value: WorkspaceHostTarget) => void;
}) {
  const { t } = useTranslation();
  if (hidden) return null;
  return (
    <div className="dashboard-workspace-host-selector">
      <Text strong>{t('dashboard.workspaceHostTitle')}</Text>
      <div className="dashboard-workspace-host-actions">
        <Button
          type={workspaceHostTarget === 'desktop' ? 'primary' : 'tertiary'}
          theme={workspaceHostTarget === 'desktop' ? 'solid' : 'light'}
          onClick={() => onChange('desktop')}
        >
          {t('dashboard.workspaceHostDesktop')}
        </Button>
        <Button
          type={workspaceHostTarget === 'gateway' ? 'primary' : 'tertiary'}
          theme={workspaceHostTarget === 'gateway' ? 'solid' : 'light'}
          onClick={() => onChange('gateway')}
        >
          {t('dashboard.workspaceHostGateway')}
        </Button>
      </div>
      <Text type="tertiary" size="small">
        {t('dashboard.workspaceHostDesc')}
      </Text>
    </div>
  );
}

function DesktopRepositoryFlow({
  mode,
  loading,
  disabled,
  binding,
  status,
  setupFeedbackKind,
  onCreateRepository,
  onBindRepository,
  onSemanticMapping,
  onApproveAdaptation,
  mappingLoading,
}: {
  mode: WorkspaceChoice;
  loading: boolean;
  disabled: boolean;
  binding: RepositoryBinding | null;
  status: RepositoryStatus;
  setupFeedbackKind: string;
  onCreateRepository: () => void;
  onBindRepository: () => void;
  onSemanticMapping: () => void;
  onApproveAdaptation: () => void;
  mappingLoading: boolean;
}) {
  const { t } = useTranslation();
  const isCreate = mode === 'create';
  const canAdapt = Boolean(binding && status !== 'repo_ready');
  return (
    <div className="dashboard-workspace-flow-panel">
      <div className="dashboard-workspace-flow-copy">
        <Text strong>{isCreate ? t('dashboard.workspaceCreateTitle') : t('dashboard.workspaceBindTitle')}</Text>
        <Text type="tertiary" size="small">
          {isCreate ? t('dashboard.workspaceCreateDesc') : t('dashboard.workspaceBindDesc')}
        </Text>
      </div>
      <Space wrap>
        <Button
          type="primary"
          icon={isCreate ? <IconPlusCircle /> : <IconFolderOpen />}
          loading={loading}
          disabled={disabled}
          onClick={isCreate ? onCreateRepository : onBindRepository}
        >
          {isCreate ? t('dashboard.workspaceChooseSaveLocation') : t('dashboard.workspaceChooseExistingRepository')}
        </Button>
        {!isCreate && (
          <Button icon={<IconBranch />} loading={mappingLoading} disabled={!binding} onClick={onSemanticMapping}>
            {t('dashboard.workspaceSemanticInspect')}
          </Button>
        )}
        {!isCreate && (
          <Button loading={loading} disabled={!canAdapt} onClick={onApproveAdaptation}>
            {t('repositoryGate.approveAdaptation')}
          </Button>
        )}
      </Space>
      {binding ? (
        <WorkspaceStatusLine
          icon={<IconFolderOpen />}
          status={status}
          path={binding.repoPath}
          tag={t(`repositoryGate.setupFeedback.${setupFeedbackKind}.tag`)}
        />
      ) : (
        <Text type="tertiary" size="small">
          {isCreate ? t('dashboard.workspaceCreateEmpty') : t('dashboard.workspaceBindEmpty')}
        </Text>
      )}
    </div>
  );
}

function GatewayRepositoryFlow({
  mode,
  loading,
  disabled,
  path,
  binding,
  status,
  onPathChange,
  onSubmit,
}: {
  mode: WorkspaceChoice;
  loading: boolean;
  disabled: boolean;
  path: string;
  binding: RepositoryBinding | null;
  status: RepositoryStatus;
  onPathChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const isCreate = mode === 'create';
  return (
    <div className="dashboard-workspace-flow-panel">
      <div className="dashboard-workspace-flow-copy">
        <Text strong>
          {isCreate ? t('dashboard.workspaceGatewayCreateTitle') : t('dashboard.workspaceGatewayBindTitle')}
        </Text>
        <Text type="tertiary" size="small">
          {isCreate ? t('dashboard.workspaceGatewayCreateDesc') : t('dashboard.workspaceGatewayBindDesc')}
        </Text>
      </div>
      <div className="dashboard-workspace-path-row">
        <Input
          value={path}
          onChange={onPathChange}
          prefix={<IconCloud />}
          placeholder={t('dashboard.workspaceGatewayPathPlaceholder')}
          disabled={loading}
        />
        <Button type="primary" loading={loading} disabled={disabled || !path.trim()} onClick={onSubmit}>
          {isCreate ? t('dashboard.workspaceGatewayInitialize') : t('dashboard.workspaceGatewayBind')}
        </Button>
      </div>
      {binding ? (
        <WorkspaceStatusLine icon={<IconCloud />} status={status} path={binding.repoPath} tag={binding.location} />
      ) : (
        <Text type="tertiary" size="small">
          {t('dashboard.workspaceGatewayEmpty')}
        </Text>
      )}
    </div>
  );
}

function WorkspaceStatusLine({
  icon,
  status,
  path,
  tag,
}: {
  icon: ReactNode;
  status: RepositoryStatus;
  path: string;
  tag: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="dashboard-workspace-status-line">
      <span className="dashboard-onboarding-step-icon">{icon}</span>
      <span>
        <Text strong>{t(`repositoryGate.status.${status}`)}</Text>
        <Text type="tertiary" size="small">
          {path}
        </Text>
      </span>
      <Tag color={status === 'repo_ready' ? 'green' : 'blue'}>{tag}</Tag>
    </div>
  );
}

function RepositoryReadyPanel({
  binding,
  firstMatterDraft,
  firstMatterCreating,
  onFirstMatterDraftChange,
  onCreateFirstMatter,
}: {
  binding: RepositoryBinding;
  firstMatterDraft: string;
  firstMatterCreating: boolean;
  onFirstMatterDraftChange: (value: string) => void;
  onCreateFirstMatter: (binding: RepositoryBinding) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="dashboard-onboarding-ready">
      <div>
        <Text strong>{t('dashboard.onboardingRepositoryReady')}</Text>
        <Text type="tertiary" size="small">
          {t('dashboard.onboardingRepositoryReadyDesc')}
        </Text>
      </div>
      <div className="dashboard-first-matter-form">
        <Input
          value={firstMatterDraft}
          placeholder={t('dashboard.firstMatterPlaceholder')}
          onChange={onFirstMatterDraftChange}
          onEnterPress={() => onCreateFirstMatter(binding)}
          disabled={firstMatterCreating}
        />
        <Button
          theme="solid"
          type="primary"
          loading={firstMatterCreating}
          disabled={!firstMatterDraft.trim()}
          onClick={() => onCreateFirstMatter(binding)}
        >
          {t('dashboard.createFirstMatter')}
        </Button>
      </div>
    </div>
  );
}

function WorkspaceChoiceCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  selected,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  selected?: boolean;
}) {
  return (
    <div
      className={`dashboard-workspace-choice-card${selected ? ' dashboard-workspace-choice-card-active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onAction}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAction();
        }
      }}
    >
      <span className="dashboard-onboarding-step-icon">{icon}</span>
      <div className="dashboard-workspace-choice-body">
        <div className="dashboard-workspace-choice-title">
          <Text strong>{title}</Text>
        </div>
        <Text type="tertiary" size="small">
          {description}
        </Text>
        <Button
          size="small"
          theme="borderless"
          onClick={(event) => {
            event.stopPropagation();
            onAction();
          }}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function isLocalGatewayUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '::1' || hostname === '0.0.0.0' || hostname.startsWith('127.');
  } catch {
    return false;
  }
}
