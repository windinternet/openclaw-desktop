import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Card, Empty, Space, Spin, Tabs, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import {
  loadRepositoryProtocolSnapshot,
  type RepositoryProtocolDocument,
  type RepositoryProtocolSnapshot,
} from '../lib/repository-protocol';
import { useStore } from '../lib/store';

const { Title, Text } = Typography;

interface EmbeddedPageProps {
  embedded?: boolean;
  onHeaderActionsChange?: (actions: ReactNode | null) => void;
}

export default function RepositoryProtocolPage({ embedded = false, onHeaderActionsChange }: EmbeddedPageProps = {}) {
  const { t } = useTranslation();
  const currentInstanceId = useStore((state) => state.currentInstanceId);
  const [snapshot, setSnapshot] = useState<RepositoryProtocolSnapshot | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const permissionItems = useMemo(
    () => [
      t('controlCenter.localFiles'),
      t('controlCenter.repositoryReadWrite'),
      t('controlCenter.gatewayTools'),
      t('controlCenter.companionCommands'),
      t('controlCenter.network'),
      t('controlCenter.execution'),
    ],
    [t],
  );

  const load = useCallback(async () => {
    if (!currentInstanceId) {
      setStatus('empty');
      setSnapshot(null);
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const binding = await loadRepositoryBinding(currentInstanceId);
      if (!binding || binding.status !== 'repo_ready' || binding.location !== 'desktop-local') {
        setStatus('empty');
        setSnapshot(null);
        return;
      }
      setSnapshot(await loadRepositoryProtocolSnapshot(binding));
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [currentInstanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const headerActions = useMemo(() => <Button onClick={load}>{t('common.refresh')}</Button>, [load, t]);

  useEffect(() => {
    if (!embedded) return undefined;
    onHeaderActionsChange?.(headerActions);
    return () => onHeaderActionsChange?.(null);
  }, [embedded, headerActions, onHeaderActionsChange]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: embedded ? '12px 0 0' : 24 }}>
      {!embedded && (
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
          <div>
            <Title heading={3} style={{ marginTop: 0, marginBottom: 4 }}>
              {t('controlCenter.repositoryProtocol')}
            </Title>
            <Text type="tertiary">{t('controlCenter.repositoryProtocolDesc')}</Text>
          </div>
          {headerActions}
        </Space>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Card>
          <Space vertical align="start">
            <Tag color="green">OpenClaw</Tag>
            <Text strong>{t('controlCenter.runtimeLayer')}</Text>
            <Text type="tertiary" size="small">
              {t('controlCenter.runtimeLayerDesc')}
            </Text>
          </Space>
        </Card>
        <Card>
          <Space vertical align="start">
            <Tag color="blue">Repository</Tag>
            <Text strong>{t('controlCenter.repositoryLayer')}</Text>
            <Text type="tertiary" size="small">
              {t('controlCenter.repositoryLayerDesc')}
            </Text>
          </Space>
        </Card>
        <Card>
          <Space vertical align="start">
            <Text strong>{t('controlCenter.permissionOverview')}</Text>
            <Space wrap>
              {permissionItems.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </Space>
          </Space>
        </Card>
      </div>

      {status === 'loading' && <Spin />}
      {status === 'error' && <Empty title={t('common.failed')} description={error ?? t('common.unknown')} />}
      {status === 'empty' && (
        <Empty title={t('repositoryGate.status.repo_unbound')} description={t('repositoryGate.hint.repo_unbound')} />
      )}
      {status === 'ready' && snapshot && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 320px) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Card title={t('controlCenter.pathMappings')}>
            <Space vertical align="start" style={{ width: '100%' }}>
              {snapshot.pathMappings.map((item) => (
                <div key={item.path} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <Text type="tertiary">{item.label}</Text>
                  <Text code>{item.path}</Text>
                </div>
              ))}
            </Space>
          </Card>
          <Card title={t('controlCenter.protocolDocuments')}>
            <Tabs type="line">
              {snapshot.documents.map((document) => (
                <Tabs.TabPane tab={document.title} itemKey={document.path} key={document.path}>
                  <ProtocolDocumentView document={document} />
                </Tabs.TabPane>
              ))}
            </Tabs>
          </Card>
        </div>
      )}
    </div>
  );
}

function ProtocolDocumentView({ document }: { document: RepositoryProtocolDocument }) {
  const { t } = useTranslation();
  if (document.missing) {
    return <Empty title={t('common.noContent')} description={document.path} />;
  }
  return (
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        maxHeight: 520,
        overflow: 'auto',
        display: 'block',
        padding: 12,
        borderRadius: 6,
        background: 'var(--semi-color-fill-0)',
      }}
    >
      {document.content}
    </pre>
  );
}
