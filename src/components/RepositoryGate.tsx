import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, Input, Select, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBranch, IconCloud, IconFolderOpen, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { RepositoryBinding, RepositoryLocation, RepositoryStatus } from '../lib/agentic-repository';
import {
  bootstrapRepositoryBinding,
  createAndSaveRepositoryBinding,
  inspectRepositoryBinding,
  loadRepositoryBinding,
  saveRepositoryBinding,
} from '../lib/agentic-repository-store';

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

export default function RepositoryGate({
  area,
  children,
}: {
  area: 'knowledge' | 'workbench';
  children: ReactNode | ((binding: RepositoryBinding) => ReactNode);
}) {
  const { t } = useTranslation();
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const [binding, setBinding] = useState<RepositoryBinding | null>(null);
  const [repoPath, setRepoPath] = useState('');
  const [gatewayRepoUrl, setGatewayRepoUrl] = useState('');
  const [gatewayTargetPath] = useState('~/OpenClaw/Agentic Repository');
  const [location, setLocation] = useState<RepositoryLocation>('desktop-local');
  const [status, setStatus] = useState<RepositoryStatus>('repo_unbound');
  const [loading, setLoading] = useState(false);
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

  const ready = status === 'repo_ready';
  const showDesktopActions = location === 'desktop-local';
  const canRefresh = Boolean(binding);

  return (
    <div style={{ marginTop: 20 }}>
      <Card>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space align="center">
            {ready ? <IconTickCircle /> : <IconBranch />}
            <Title heading={5} style={{ margin: 0 }}>
              {t(`repositoryGate.${area}Title`)}
            </Title>
            <Tag color={STATUS_COLOR[status]}>{t(`repositoryGate.status.${status}`)}</Tag>
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
      {ready && binding && (
        <div style={{ marginTop: 20 }}>
          {typeof children === 'function' ? children(binding) : children}
        </div>
      )}
    </div>
  );
}
