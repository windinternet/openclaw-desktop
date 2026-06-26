import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, Input, Modal, Select, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBranch, IconCloud, IconFolderOpen, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway, useStore } from '../lib';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type {
  KnowledgeRepositoryMapping,
  RepositoryBinding,
  RepositoryLocation,
  RepositoryStatus,
  WorkbenchSemanticMapping,
} from '../lib/agentic-repository';
import {
  bootstrapRepositoryBinding,
  createAndSaveRepositoryBinding,
  inspectRepositoryBinding,
  loadRepositoryBinding,
  saveRepositoryBinding,
} from '../lib/agentic-repository-store';
import {
  buildKnowledgeRepositoryMappingPrompt,
  parseKnowledgeRepositoryMappingResponse,
} from '../lib/repository-knowledge';
import {
  buildWorkbenchSemanticMappingPrompt,
  parseWorkbenchSemanticMappingResponse,
  sanitizeWorkbenchSemanticMapping,
  type WorkbenchStructureSignal,
} from '../lib/repository-workbench-mapping';

const { Text, Title } = Typography;

const STATUS_COLOR: Record<RepositoryStatus, 'green' | 'orange' | 'red' | 'blue' | 'grey'> = {
  repo_ready: 'green',
  repo_unbound: 'orange',
  git_missing: 'red',
  repo_path_missing: 'orange',
  repo_not_git: 'orange',
  repo_empty: 'blue',
  repo_needs_bootstrap: 'blue',
  repo_remote_unreachable: 'red',
  repo_permission_denied: 'red',
};

function canUseSemanticMappingForStatus(value: RepositoryStatus): boolean {
  switch (value) {
    case 'repo_needs_bootstrap':
      return true;
    case 'git_missing':
    case 'repo_path_missing':
    case 'repo_permission_denied':
    case 'repo_remote_unreachable':
    case 'repo_unbound':
    case 'repo_not_git':
    case 'repo_empty':
    case 'repo_ready':
      return false;
    default:
      return false;
  }
}

export default function RepositoryGate({
  area,
  children,
  fallback,
  setupVisible = true,
}: {
  area: 'knowledge' | 'workbench';
  children?: ReactNode | ((binding: RepositoryBinding) => ReactNode);
  fallback?: ReactNode;
  setupVisible?: boolean;
}) {
  const { t } = useTranslation();
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const activeClient = useStore((s) => s.activeClient);
  const agents = useStore((s) => s.agents);
  const [binding, setBinding] = useState<RepositoryBinding | null>(null);
  const [repoPath, setRepoPath] = useState('');
  const [gatewayRepoUrl, setGatewayRepoUrl] = useState('');
  const [gatewayTargetPath] = useState('~/OpenClaw/Agentic Repository');
  const [location, setLocation] = useState<RepositoryLocation>('desktop-local');
  const [status, setStatus] = useState<RepositoryStatus>('repo_unbound');
  const [loading, setLoading] = useState(false);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [advancedManualPath, setAdvancedManualPath] = useState(false);

  const inspect = useCallback(async (nextBinding: RepositoryBinding) => {
    setLoading(true);
    try {
      const result = await inspectRepositoryBinding(nextBinding);
      setBinding(result.binding);
      setStatus(result.status);
      setRepoPath(result.binding.repoPath);
      setLocation(result.binding.location);
      await saveRepositoryBinding(result.binding);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!currentInstanceId) {
      setBinding(null);
      setStatus('repo_unbound');
      return;
    }

    setLoading(true);
    loadRepositoryBinding(currentInstanceId)
      .then(async (stored) => {
        if (cancelled) return;
        if (!stored) {
          setBinding(null);
          setStatus('repo_unbound');
          return;
        }
        setBinding(stored);
        setRepoPath(stored.repoPath);
        setLocation(stored.location);
        await inspect(stored);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, inspect]);

  const bindAndInspect = async (path: string, nextLocation: RepositoryLocation = location) => {
    if (!currentInstanceId || !path.trim()) return null;
    setLoading(true);
    try {
      const next = await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: path.trim(),
        location: nextLocation,
      });
      await inspect(next);
      Toast.success(t('repositoryGate.saved'));
      return next;
    } finally {
      setLoading(false);
    }
  };

  const handleBind = async () => {
    await bindAndInspect(repoPath, location);
  };

  const handleLocationChange = async (value: RepositoryLocation) => {
    setLocation(value);
    setAdvancedManualPath(false);
    if (!currentInstanceId) return;
    const stored = await loadRepositoryBinding(currentInstanceId, value);
    if (!stored) {
      setBinding(null);
      setStatus('repo_unbound');
      setRepoPath('');
      return;
    }
    setBinding(stored);
    setRepoPath(stored.repoPath);
    setStatus(stored.status);
    await inspect(stored);
  };

  const handleChooseDirectory = async () => {
    const selected = await window.electronAPI?.repository?.chooseDirectory?.();
    if (!selected) return;
    setRepoPath(selected);
    await bindAndInspect(selected, 'desktop-local');
  };

  const handleInitializeDefaultDesktopRepository = async () => {
    if (!currentInstanceId) return;
    const defaultPath = await window.electronAPI?.repository?.getDefaultPath?.();
    if (!defaultPath) {
      Toast.error(t('repositoryGate.localRepositoryUnavailable'));
      return;
    }
    setLoading(true);
    try {
      const next = await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: defaultPath,
        location: 'desktop-local',
      });
      const result = await bootstrapRepositoryBinding(next);
      setBinding(result.binding);
      setStatus(result.status);
      setRepoPath(result.binding.repoPath);
      setLocation(result.binding.location);
      await saveRepositoryBinding(result.binding);
      Toast.success(t('repositoryGate.bootstrapDone'));
    } finally {
      setLoading(false);
    }
  };

  const handleGatewayClone = async () => {
    if (!currentInstanceId) return;
    if (!gatewayRepoUrl.trim()) {
      Toast.warning(t('repositoryGate.gatewayRepoUrlRequired'));
      return;
    }
    await bindAndInspect(gatewayTargetPath, 'gateway-local');
    Toast.warning(t('repositoryGate.gatewayCapabilityPending'));
  };

  const handleGatewayInitializeHome = async () => {
    if (!currentInstanceId) return;
    await bindAndInspect(gatewayTargetPath, 'gateway-local');
    Toast.warning(t('repositoryGate.gatewayCapabilityPending'));
  };

  const handleBootstrap = async () => {
    if (!binding) return;
    setLoading(true);
    try {
      const result = await bootstrapRepositoryBinding(binding);
      setBinding(result.binding);
      setStatus(result.status);
      await saveRepositoryBinding(result.binding);
      Toast.success(t('repositoryGate.bootstrapDone'));
    } finally {
      setLoading(false);
    }
  };

  const readMappingExcerpts = async (path: string, tree: string[]) => {
    const repository = window.electronAPI?.repository;
    if (!repository?.readText) return [];
    const readText = repository.readText;
    const candidates = ['AGENTS.md', 'README.md', 'CLAUDE.md', 'GEMINI.md', ...tree.filter((entry) => /(^|\/)(README|index|log)\.md$/i.test(entry)).slice(0, 8)];
    const unique = Array.from(new Set(candidates.filter((entry) => !entry.endsWith('/')))).slice(0, 10);
    const excerpts = await Promise.all(unique.map(async (entry) => ({
      path: entry,
      content: await readText(path, entry),
    })));
    return excerpts.filter((item) => item.content.trim().length > 0);
  };

  const buildWorkbenchStructureSignals = (tree: string[]): WorkbenchStructureSignal[] => {
    const signals = tree
      .map((path) => ({ path, hints: inferWorkbenchPathHints(path) }))
      .filter((item) => item.hints.length > 0);
    return signals.slice(0, 120);
  };

  const inferWorkbenchPathHints = (path: string): string[] => {
    const normalized = path.toLowerCase();
    const hints: string[] = [];
    if (/(^|\/)(inbox|capture|captures|input|inputs)(\/|\.md$)/.test(normalized)) hints.push('inbox');
    if (/(^|\/)(now|current|active)\.md$/.test(normalized) || /(^|\/)(current|active)(\/|$)/.test(normalized)) hints.push('current-work');
    if (/(^|\/)(next|todo|backlog|someday)\.md$/.test(normalized) || /(^|\/)(next|todo|backlog|someday)(\/|$)/.test(normalized)) hints.push('next-work');
    if (/(^|\/)(done|completed|archive)\.md$/.test(normalized) || /(^|\/)(done|completed)(\/|$)/.test(normalized)) hints.push('done-work');
    if (/(^|\/)(project|projects|initiative|initiatives|client|clients)(\/|$)/.test(normalized) || /(^|\/)(readme|brief|prd)\.md$/.test(normalized)) hints.push('project-system');
    if (/(^|\/)(plan|roadmap|milestone|timeline)\.md$/.test(normalized) || /(^|\/)(plans)(\/|$)/.test(normalized)) hints.push('planning');
    if (/(^|\/)(run|runs|log|logs|journal)(\/|\.md$)/.test(normalized)) hints.push('execution-record');
    if (/(^|\/)(output|outputs|deliverable|deliverables|artifact|artifacts)(\/|$)/.test(normalized)) hints.push('output');
    if (/(^|\/)(review|reviews|retro|retrospective)(\/|\.md$)/.test(normalized)) hints.push('review');
    if (/(^|\/)(tool|tools|script|scripts|template|templates|sop|prompts?)(\/|\.md$)/.test(normalized)) hints.push('reusable-tool');
    if (/(^|\/)(knowledge|wiki|source|sources|map|maps)(\/|$)/.test(normalized)) hints.push('knowledge-system');
    if (/(^|\/)(agent|agents|agentic|workflow|workflows)(\/|\.md$)/.test(normalized)) hints.push('agent-workflow');
    return hints;
  };

  const isSafeMapping = (mapping: KnowledgeRepositoryMapping): boolean => {
    const paths = [
      mapping.sourceRoot,
      mapping.wikiRoot,
      mapping.indexPath,
      mapping.logPath,
      mapping.schemaPath,
      mapping.mapsRoot,
      mapping.assetsRoot,
    ].filter(Boolean) as string[];
    return paths.every((item) => !item.startsWith('/') && !item.includes('..') && item.trim().length > 0);
  };

  const saveKnowledgeMapping = async (base: RepositoryBinding, mapping: KnowledgeRepositoryMapping) => {
    const next: RepositoryBinding = {
      ...base,
      schemaProfile: 'llm-wiki',
      knowledge: mapping,
    };
    setBinding(next);
    setRepoPath(next.repoPath);
    await saveRepositoryBinding(next);
    return next;
  };

  const saveWorkbenchMapping = async (base: RepositoryBinding, mapping: WorkbenchSemanticMapping) => {
    const next: RepositoryBinding = {
      ...base,
      schemaProfile: base.schemaProfile === 'default' ? 'semantic-workbench' : base.schemaProfile,
      workbench: mapping,
    };
    setBinding(next);
    setRepoPath(next.repoPath);
    await saveRepositoryBinding(next);
    return next;
  };

  const handleSemanticKnowledgeMapping = async () => {
    if (!currentInstanceId) return;
    if (!activeClient) {
      Toast.error(t('repositoryGate.mappingNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('repositoryGate.mappingNoAgent'));
      return;
    }
    const path = repoPath.trim() || binding?.repoPath;
    if (!path) {
      Toast.warning(t('repositoryGate.noFolderSelected'));
      return;
    }
    const repository = window.electronAPI?.repository;
    if (!repository?.listTree) {
      Toast.error(t('repositoryGate.localRepositoryUnavailable'));
      return;
    }

    setMappingLoading(true);
    try {
      const base = binding ?? await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: path,
        location,
      });
      const tree = await repository.listTree(path, 400);
      const excerpts = await readMappingExcerpts(path, tree);
      const run = createAiActionRun({
        type: 'knowledge_repository_map',
        sourcePage: 'knowledge',
        instanceId: currentInstanceId,
        agentId: agent.id,
        executionMode: 'isolated-session',
        input: t('repositoryGate.mappingActionInput', { path }),
      });
      await upsertAiActionRun(currentInstanceId, { ...run, status: 'planning', updatedAt: Date.now() });
      const running = await executeAiActionRunWithGateway(activeClient, run, {
        title: t('repositoryGate.mappingActionTitle'),
        prompt: buildKnowledgeRepositoryMappingPrompt({ repoPath: path, tree, excerpts }),
      });
      await upsertAiActionRun(currentInstanceId, running);

      let latest = running;
      for (let index = 0; index < 10; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latest = await syncAiActionRunWithGateway(activeClient, latest);
        await upsertAiActionRun(currentInstanceId, latest);
        if (latest.status === 'done' || latest.status === 'failed' || latest.status === 'cancelled') break;
      }

      const parsed = parseKnowledgeRepositoryMappingResponse(latest.lastAssistantResponse ?? '');
      if (!parsed?.isKnowledgeRepository || !parsed.mapping) {
        Toast.error(parsed?.reason || t('repositoryGate.mappingFailed'));
        return;
      }
      if (!isSafeMapping(parsed.mapping)) {
        Toast.error(t('repositoryGate.mappingUnsafe'));
        return;
      }

      Modal.confirm({
        title: t('repositoryGate.mappingConfirmTitle'),
        content: (
          <Space vertical align="start">
            <Text>{t('repositoryGate.mappingConfirmDesc')}</Text>
            <Text size="small">sourceRoot: {parsed.mapping.sourceRoot}</Text>
            <Text size="small">wikiRoot: {parsed.mapping.wikiRoot}</Text>
            <Text size="small">indexPath: {parsed.mapping.indexPath}</Text>
            <Text size="small">logPath: {parsed.mapping.logPath}</Text>
          </Space>
        ),
        okText: t('common.save'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          const next = await saveKnowledgeMapping(base, parsed.mapping!);
          await inspect(next);
          Toast.success(t('repositoryGate.mappingSaved'));
        },
      });
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('repositoryGate.mappingFailed'));
    } finally {
      setMappingLoading(false);
    }
  };

  const handleSemanticWorkbenchMapping = async () => {
    if (!currentInstanceId) return;
    if (!activeClient) {
      Toast.error(t('repositoryGate.mappingNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('repositoryGate.mappingNoAgent'));
      return;
    }
    const path = repoPath.trim() || binding?.repoPath;
    if (!path) {
      Toast.warning(t('repositoryGate.noFolderSelected'));
      return;
    }
    const repository = window.electronAPI?.repository;
    if (!repository?.listTree) {
      Toast.error(t('repositoryGate.localRepositoryUnavailable'));
      return;
    }

    setMappingLoading(true);
    try {
      const base = binding ?? await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: path,
        location,
      });
      const tree = await repository.listTree(path, 400);
      const structureSignals = buildWorkbenchStructureSignals(tree);
      const run = createAiActionRun({
        type: 'workbench_repository_map',
        sourcePage: 'workbench',
        instanceId: currentInstanceId,
        agentId: agent.id,
        executionMode: 'isolated-session',
        input: t('repositoryGate.workbenchMappingActionInput', { path }),
      });
      await upsertAiActionRun(currentInstanceId, { ...run, status: 'planning', updatedAt: Date.now() });
      const running = await executeAiActionRunWithGateway(activeClient, run, {
        title: t('repositoryGate.workbenchMappingActionTitle'),
        prompt: buildWorkbenchSemanticMappingPrompt({ repoPath: path, tree, structureSignals }),
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
      if (!parsed?.isWorkbenchRepository || !parsed.mapping) {
        Toast.error(parsed?.reason || t('repositoryGate.workbenchMappingFailed'));
        return;
      }
      const sanitized = sanitizeWorkbenchSemanticMapping({ mapping: parsed.mapping, tree });
      if (!sanitized) {
        Toast.error(t('repositoryGate.mappingUnsafe'));
        return;
      }

      const next = await saveWorkbenchMapping(base, sanitized);
      await inspect(next);
      Toast.success(t('repositoryGate.workbenchMappingSaved'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('repositoryGate.workbenchMappingFailed'));
    } finally {
      setMappingLoading(false);
    }
  };

  const knowledgeMappingReady = Boolean(binding?.knowledge && binding.knowledge.mappingSource !== 'default');
  const workbenchMappingReady = Boolean(binding?.workbench?.isWorkbenchRepository);
  const semanticMappingReady = canUseSemanticMappingForStatus(status) && ((area === 'knowledge' && knowledgeMappingReady) || (area === 'workbench' && workbenchMappingReady));
  const ready = status === 'repo_ready' || semanticMappingReady;
  const displayStatus = ready ? 'repo_ready' : status;
  const showDesktopActions = location === 'desktop-local';
  const canRefresh = Boolean(binding);

  if (!setupVisible) {
    if (ready && binding) return <>{typeof children === 'function' ? children(binding) : children}</>;
    return <>{fallback ?? null}</>;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <Card>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space align="center">
            {ready ? <IconTickCircle /> : <IconBranch />}
            <Title heading={5} style={{ margin: 0 }}>
              {t(`repositoryGate.${area}Title`)}
            </Title>
            <Tag color={STATUS_COLOR[displayStatus]}>{t(`repositoryGate.status.${displayStatus}`)}</Tag>
            {area === 'workbench' && binding?.workbench && (
              <>
                <Tag color="blue">{binding.workbench.mappingSource}</Tag>
                {binding.workbench.confidence && <Tag color="grey">{binding.workbench.confidence}</Tag>}
              </>
            )}
          </Space>
          <Text type="tertiary">{t(`repositoryGate.${area}Desc`)}</Text>
          <Space wrap style={{ width: '100%' }}>
            <Select
              value={location}
              onChange={(value) => void handleLocationChange(value as RepositoryLocation)}
              style={{ width: 180 }}
              optionList={[
                { label: t('repositoryGate.desktopLocal'), value: 'desktop-local' },
                { label: t('repositoryGate.gatewayLocal'), value: 'gateway-local' },
              ]}
            />
            <Button icon={<IconRefresh />} loading={loading} disabled={!canRefresh} onClick={() => binding && inspect(binding)}>
              {t('common.refresh')}
            </Button>
          </Space>
          {showDesktopActions ? (
            <Card style={{ width: '100%', background: 'var(--semi-color-fill-0)' }} bodyStyle={{ padding: 14 }}>
              <Space vertical align="start" style={{ width: '100%' }}>
                <Text strong>{t('repositoryGate.desktopSetupTitle')}</Text>
                <Text type="tertiary" size="small">{t('repositoryGate.desktopSetupDesc')}</Text>
                <Space wrap>
                  <Button
                    icon={<IconFolderOpen />}
                    type="primary"
                    loading={loading}
                    disabled={!currentInstanceId}
                    onClick={handleChooseDirectory}
                  >
                    {t('repositoryGate.desktopChooseFolder')}
                  </Button>
                  <Button
                    loading={loading}
                    disabled={!currentInstanceId}
                    onClick={handleInitializeDefaultDesktopRepository}
                  >
                    {t('repositoryGate.desktopInitializeDefault')}
                  </Button>
                  <Button loading={loading} disabled={!binding || ready} onClick={handleBootstrap}>
                    {t('repositoryGate.bootstrap')}
                  </Button>
                  {area === 'knowledge' && (
                    <Button loading={mappingLoading} disabled={!currentInstanceId || !repoPath.trim()} onClick={() => void handleSemanticKnowledgeMapping()}>
                      {t('repositoryGate.semanticMapKnowledge')}
                    </Button>
                  )}
                  {area === 'workbench' && (
                    <Button
                      icon={<IconBranch />}
                      loading={mappingLoading}
                      disabled={location !== 'desktop-local'}
                      onClick={() => void handleSemanticWorkbenchMapping()}
                    >
                      {t('repositoryGate.mapWorkbenchSemantically')}
                    </Button>
                  )}
                </Space>
                {repoPath ? (
                  <Text type="tertiary" size="small">{t('repositoryGate.currentPath', { path: repoPath })}</Text>
                ) : (
                  <Text type="tertiary" size="small">{t('repositoryGate.noFolderSelected')}</Text>
                )}
              </Space>
            </Card>
          ) : (
            <Card style={{ width: '100%', background: 'var(--semi-color-fill-0)' }} bodyStyle={{ padding: 14 }}>
              <Space vertical align="start" style={{ width: '100%' }}>
                <Text strong>{t('repositoryGate.gatewaySetupTitle')}</Text>
                <Text type="tertiary" size="small">{t('repositoryGate.gatewaySetupDesc')}</Text>
                <Input
                  value={gatewayRepoUrl}
                  onChange={setGatewayRepoUrl}
                  prefix={<IconCloud />}
                  placeholder={t('repositoryGate.gatewayRepoUrlPlaceholder')}
                  style={{ width: 'min(100%, 560px)' }}
                />
                <Space wrap>
                  <Button type="primary" loading={loading} disabled={!currentInstanceId} onClick={handleGatewayClone}>
                    {t('repositoryGate.gatewayClone')}
                  </Button>
                  <Button loading={loading} disabled={!currentInstanceId} onClick={handleGatewayInitializeHome}>
                    {t('repositoryGate.gatewayInitializeHome')}
                  </Button>
                </Space>
                <Text type="tertiary" size="small">{t('repositoryGate.gatewayTargetPath', { path: gatewayTargetPath })}</Text>
              </Space>
            </Card>
          )}
          <Button
            theme="borderless"
            type="tertiary"
            onClick={() => setAdvancedManualPath((value) => !value)}
          >
            {t('repositoryGate.advancedManualPath')}
          </Button>
          {advancedManualPath && (
            <Space wrap style={{ width: '100%' }}>
              <Input
                value={repoPath}
                onChange={setRepoPath}
                placeholder={showDesktopActions ? t('repositoryGate.desktopPathPlaceholder') : t('repositoryGate.gatewayPathPlaceholder')}
                style={{ minWidth: 320, flex: 1 }}
              />
              <Button type="primary" loading={loading} disabled={!currentInstanceId || !repoPath.trim()} onClick={handleBind}>
                {t('repositoryGate.bind')}
              </Button>
            </Space>
          )}
          {!ready && (
            <Text type="tertiary" size="small">
              {t(`repositoryGate.hint.${status}`)}
            </Text>
          )}
        </Space>
      </Card>
      {ready && binding && children && (
        <div style={{ marginTop: 20 }}>
          {typeof children === 'function' ? children(binding) : children}
        </div>
      )}
    </div>
  );
}
