import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Select, Tag, Card, Spin, Empty, Toast, Popconfirm } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconPlay, IconDeleteStroked, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';

const { Text, Title } = Typography;

export default function ArtifactDetailPage() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const artifacts = useStore((s) => s.artifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const deleteArtifact = useStore((s) => s.deleteArtifact);
  const updateArtifact = useStore((s) => s.updateArtifact);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState<Partial<ArtifactMeta>>({});
  const [metaFormArtifactId, setMetaFormArtifactId] = useState<string | null>(null);

  const meta = artifacts.find((a) => a.id === artifactId);

  if (meta && meta.id !== metaFormArtifactId) {
    setMetaForm({ title: meta.title, description: meta.description, icon: meta.icon, type: meta.type, tags: meta.tags });
    setMetaFormArtifactId(meta.id);
  }

  if (!meta) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin />
      </div>
    );
  }

  const statusText = (status: string) => {
    if (status === 'draft') return t('artifact.statusDraft');
    if (status === 'published') return t('artifact.statusPublished');
    return t('artifact.statusArchived');
  };

  const handleSaveMeta = async () => {
    if (!artifactId) return;
    await updateArtifact(artifactId, metaForm);
    setEditingMeta(false);
    Toast.success(t('artifact.saved'));
  };

  const handleDelete = async () => {
    if (!artifactId) return;
    await deleteArtifact(artifactId);
    navigate('/artifacts');
    Toast.success(t('artifact.deleted'));
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<IconArrowLeft />} theme="borderless" onClick={() => navigate('/artifacts')} />
        <span style={{ fontSize: 24 }}>{meta.icon}</span>
        <Title heading={4} style={{ margin: 0, flex: 1 }}>{meta.title}</Title>
        <Tag size="large" color={meta.status === 'published' ? 'green' : meta.status === 'draft' ? 'orange' : 'grey'} type="light">
          {statusText(meta.status)}
        </Tag>
        <Button icon={<IconPlay />} theme="solid" onClick={() => openArtifactWindow(meta.id)}>{t('artifact.view')}</Button>
        {meta.status !== 'published' && (
          <Button onClick={() => { updateArtifact(meta.id, { status: 'published' }); }}>{t('artifact.publish')}</Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Card title={t('artifact.meta')}
          headerExtraContent={
            <Button size="small" onClick={() => editingMeta ? handleSaveMeta() : setEditingMeta(true)}>
              {editingMeta ? t('artifact.save') : t('artifact.edit')}
            </Button>
          }
        >
          {editingMeta ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input addonBefore={t('artifact.title')} value={metaForm.title ?? ''} onChange={(v) => setMetaForm((p) => ({ ...p, title: v }))} />
              <Input addonBefore={t('artifact.icon')} value={metaForm.icon ?? ''} onChange={(v) => setMetaForm((p) => ({ ...p, icon: v }))} />
              <Select value={metaForm.type} onChange={(v) => setMetaForm((p) => ({ ...p, type: v as ArtifactMeta['type'] }))}
                optionList={[
                  { value: 'report', label: t('artifact.typeReport') }, { value: 'dashboard', label: t('artifact.typeDashboard') },
                  { value: 'analysis', label: t('artifact.typeAnalysis') }, { value: 'checklist', label: t('artifact.typeChecklist') },
                  { value: 'code', label: t('artifact.typeCode') }, { value: 'document', label: t('artifact.typeDoc') },
                  { value: 'other', label: t('artifact.typeOther') },
                ]}
              />
              <Input addonBefore={t('artifact.desc')} value={metaForm.description ?? ''} onChange={(v) => setMetaForm((p) => ({ ...p, description: v }))} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><Text type="tertiary">{t('artifact.title')}: </Text><Text>{meta.title}</Text></div>
              <div><Text type="tertiary">{t('artifact.icon')}: </Text><span style={{ fontSize: 20 }}>{meta.icon}</span></div>
              <div><Text type="tertiary">{t('artifact.type')}: </Text><Tag size="small">{meta.type}</Tag></div>
              <div><Text type="tertiary">{t('artifact.source')}: </Text><Text>{meta.source.name ?? meta.source.type}</Text></div>
              {meta.description && <div><Text type="tertiary">{t('artifact.desc')}: </Text><Text>{meta.description}</Text></div>}
              {meta.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {meta.tags.map((tag) => <Tag key={tag} size="small" type="light">{tag}</Tag>)}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title={t('artifact.versions')}>
          <Empty title={t('artifact.noVersions')} />
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Card title={t('artifact.actions')}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button icon={<IconRefresh />} onClick={() => Toast.info(t('artifact.regenNotImplemented'))}>
              {t('artifact.regen')}
            </Button>
            {meta.source.type === 'chat' && meta.source.id && (
              <Button onClick={() => navigate(`/chat/${encodeURIComponent(meta.source.id!)}`)}>
                {t('artifact.goToChat')}
              </Button>
            )}
            <Popconfirm title={t('artifact.deleteConfirm')} onConfirm={handleDelete}>
              <Button type="danger" icon={<IconDeleteStroked />}>{t('artifact.delete')}</Button>
            </Popconfirm>
          </div>
        </Card>
      </div>
    </div>
  );
}

export { ArtifactDetailPage };
