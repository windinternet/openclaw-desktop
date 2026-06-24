import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, Input, Select, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBranch, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
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
  const [location, setLocation] = useState<RepositoryLocation>('desktop-local');
  const [status, setStatus] = useState<RepositoryStatus>('repo_unbound');
  const [loading, setLoading] = useState(false);

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

  const handleBind = async () => {
    if (!currentInstanceId || !repoPath.trim()) return;
    setLoading(true);
    try {
      const next = await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: repoPath.trim(),
        location,
      });
      await inspect(next);
      Toast.success(t('repositoryGate.saved'));
    } finally {
      setLoading(false);
    }
  };

  const handleLocationChange = async (value: RepositoryLocation) => {
    setLocation(value);
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
            <Input
              value={repoPath}
              onChange={setRepoPath}
              placeholder={t('repositoryGate.pathPlaceholder')}
              style={{ minWidth: 320, flex: 1 }}
            />
            <Button type="primary" loading={loading} disabled={!currentInstanceId || !repoPath.trim()} onClick={handleBind}>
              {t('repositoryGate.bind')}
            </Button>
            <Button icon={<IconRefresh />} loading={loading} disabled={!binding} onClick={() => binding && inspect(binding)}>
              {t('common.refresh')}
            </Button>
            <Button loading={loading} disabled={!binding || location !== 'desktop-local' || ready} onClick={handleBootstrap}>
              {t('repositoryGate.bootstrap')}
            </Button>
          </Space>
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
