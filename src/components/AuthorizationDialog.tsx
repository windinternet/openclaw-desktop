import { useState, useEffect } from 'react';
import { Modal, Button, Typography, Tag, Space } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { getCapability } from '../lib/artifact-capabilities';

const { Text } = Typography;

interface AuthRequest {
  artifactId: string;
  capability: string;
  detail: string;
}

export function AuthorizationDialog() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState<AuthRequest | null>(null);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { artifact?: { onAuthRequest: (cb: (...args: unknown[]) => void) => void } } }).electronAPI?.artifact;
    if (!api) return;

    const handler = (...args: unknown[]) => {
      const [artifactId, capability, detail] = args as [string, string, string];
      setRequest({ artifactId, capability, detail });
      setVisible(true);
    };

    api.onAuthRequest(handler);
  }, []);

  const handleChoice = (level: string | null) => {
    setVisible(false);
    const api = (window as unknown as { electronAPI?: { artifact?: { grantAuth: (result: { granted: boolean; level: string }) => void } } }).electronAPI?.artifact;
    if (api) {
      api.grantAuth({ granted: level !== null, level: level ?? 'once' });
    }
    setRequest(null);
  };

  if (!request) return null;

  const cap = getCapability(request.capability);
  const riskLabels: Record<string, string> = { low: t('auth.lowRisk'), medium: t('auth.medRisk'), high: t('auth.highRisk') };
  const riskColors: Record<string, TagColor> = { low: 'green', medium: 'orange', high: 'red' };
  const RiskIcon = cap?.risk === 'high' ? IconAlertTriangle : cap?.risk === 'medium' ? IconAlertCircle : IconInfoCircle;
  const riskColor: TagColor = cap ? riskColors[cap.risk] : 'grey';

  return (
    <Modal
      visible={visible}
      closable={false}
      maskClosable={false}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RiskIcon style={{ color: cap?.risk === 'high' ? 'var(--semi-color-danger)' : cap?.risk === 'medium' ? 'var(--semi-color-warning)' : 'var(--semi-color-success)' }} />
          <span>{t('auth.title')}</span>
        </div>
      }
      footer={null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Text type="secondary">
            {t('auth.artifactRequest', { title: request.artifactId })}
          </Text>
        </div>

        <div style={{ background: 'var(--semi-color-fill-0)', padding: 12, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text strong>{cap?.name ?? request.capability}</Text>
            {cap && (
              <Tag size="small" color={riskColor}>
                {riskLabels[cap.risk]}
              </Tag>
            )}
          </div>
          <Text type="secondary" size="small">{cap?.description}</Text>
          {request.detail && (
            <div style={{ marginTop: 8 }}>
              <Text type="tertiary" size="small">{t('auth.target')}: {request.detail}</Text>
            </div>
          )}
        </div>

        <Space spacing="medium" wrap>
          <Button type="tertiary" onClick={() => handleChoice('once')} size="small">{t('auth.once')}</Button>
          <Button type="tertiary" onClick={() => handleChoice('session')} size="small">{t('auth.session')}</Button>
          <Button type="secondary" onClick={() => handleChoice('artifact')} size="small">{t('auth.artifact')}</Button>
          <Button type="primary" onClick={() => handleChoice('global')} size="small">{t('auth.global')}</Button>
          <Button type="danger" onClick={() => handleChoice(null)} size="small">{t('auth.deny')}</Button>
        </Space>
      </div>
    </Modal>
  );
}
