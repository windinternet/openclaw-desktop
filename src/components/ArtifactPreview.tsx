import { useState } from 'react';
import { Button, Card, Typography, Tag } from '@douyinfe/semi-ui';
import { IconPlay, IconExpand } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';

const { Text } = Typography;

interface Props {
  artifact: ArtifactMeta;
}

export function ArtifactPreview({ artifact }: Props) {
  const { t } = useTranslation();
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      style={{ margin: '8px 0', maxWidth: 600 }}
      bodyStyle={{ padding: 12 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{artifact.icon}</span>
          <Text strong>{artifact.title}</Text>
          <Tag size="small" color="orange" type="light">{artifact.type}</Tag>
        </div>
      }
      headerExtraContent={
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" theme="borderless" icon={<IconPlay />} onClick={() => openArtifactWindow(artifact.id)}>
            {t('artifact.open')}
          </Button>
          <Button size="small" theme="borderless" icon={<IconExpand />}
            onClick={() => setExpanded(!expanded)}>
            {expanded ? t('artifact.collapse') : t('artifact.expand')}
          </Button>
        </div>
      }
    >
      {artifact.description && (
        <Text type="secondary" size="small" style={{ marginBottom: 8, display: 'block' }}>
          {artifact.description}
        </Text>
      )}
      {expanded && (
        <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 4, overflow: 'hidden' }}>
          <iframe
            src={`artifact://${artifact.id}.v${artifact.currentVersion}`}
            sandbox="allow-scripts"
            style={{ width: '100%', height: 300, border: 'none' }}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        {artifact.tags.map((tag) => (
          <Tag key={tag} size="small" color="orange" type="light">{tag}</Tag>
        ))}
        <Text type="tertiary" size="small" style={{ flex: 1, textAlign: 'right' }}>
          v{artifact.currentVersion} · {new Date(artifact.updatedAt).toLocaleString()}
        </Text>
      </div>
    </Card>
  );
}
