import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Select, Tag, Card, Spin, Empty, Toast, Popconfirm } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconPlay, IconDeleteStroked, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactReuseReference } from '../lib/artifact-reference';

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
    setMetaForm({
      title: meta.title,
      description: meta.description,
      icon: meta.icon,
      type: meta.type,
      tags: meta.tags,
    });
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

  const handleCopyReference = async () => {
    await navigator.clipboard.writeText(buildArtifactReuseReference(meta).markdown);
    Toast.success(t('artifact.referenceCopied'));
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<IconArrowLeft />} theme="borderless" onClick={() => navigate('/artifacts')} />
        <span style={{ fontSize: 24 }}>{meta.icon}</span>
        <Title heading={4} style={{ margin: 0, flex: 1 }}>
          {meta.title}
        </Title>
        <Tag
          size="large"
          color={meta.status === 'published' ? 'green' : meta.status === 'draft' ? 'orange' : 'grey'}
          type="light"
        >
          {statusText(meta.status)}
        </Tag>
        {meta.type === 'link' && meta.url && (
          <Button icon={<IconPlay />} theme="solid" onClick={() => window.open(meta.url, '_blank')}>
            在浏览器打开
          </Button>
        )}
        {meta.type === 'app' && meta.command && (
          <Button
            icon={<IconPlay />}
            theme="solid"
            onClick={() => {
              navigator.clipboard.writeText(meta.command!).then(() => Toast.success('命令已复制'));
            }}
          >
            复制命令
          </Button>
        )}
        {(meta.type === 'file' || meta.type === 'audio' || meta.type === 'image' || meta.type === 'video') && (
          <Button icon={<IconPlay />} theme="solid" onClick={() => openArtifactWindow(meta.id)}>
            查看
          </Button>
        )}
        {(meta.type === 'report' ||
          meta.type === 'dashboard' ||
          meta.type === 'analysis' ||
          meta.type === 'checklist' ||
          meta.type === 'code' ||
          meta.type === 'document' ||
          meta.type === 'slide' ||
          meta.type === 'form' ||
          meta.type === 'other') && (
          <Button icon={<IconPlay />} theme="solid" onClick={() => openArtifactWindow(meta.id)}>
            {t('artifact.view')}
          </Button>
        )}
        {meta.status !== 'published' && (
          <Button
            onClick={() => {
              updateArtifact(meta.id, { status: 'published' });
            }}
          >
            {t('artifact.publish')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Card
          title={t('artifact.meta')}
          headerExtraContent={
            <Button size="small" onClick={() => (editingMeta ? handleSaveMeta() : setEditingMeta(true))}>
              {editingMeta ? t('artifact.save') : t('artifact.edit')}
            </Button>
          }
        >
          {editingMeta ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                addonBefore={t('artifact.title')}
                value={metaForm.title ?? ''}
                onChange={(v) => setMetaForm((p) => ({ ...p, title: v }))}
              />
              <Input
                addonBefore={t('artifact.icon')}
                value={metaForm.icon ?? ''}
                onChange={(v) => setMetaForm((p) => ({ ...p, icon: v }))}
              />
              <Select
                value={metaForm.type}
                onChange={(v) => setMetaForm((p) => ({ ...p, type: v as ArtifactMeta['type'] }))}
                optionList={[
                  { value: 'report', label: '报告' },
                  { value: 'dashboard', label: '仪表盘' },
                  { value: 'analysis', label: '分析' },
                  { value: 'checklist', label: '清单' },
                  { value: 'code', label: '代码' },
                  { value: 'document', label: '文档' },
                  { value: 'slide', label: '幻灯片' },
                  { value: 'form', label: '表单' },
                  { value: 'other', label: '其他' },
                  { value: 'link', label: '链接' },
                  { value: 'app', label: '应用' },
                  { value: 'file', label: '文件' },
                  { value: 'audio', label: '音频' },
                  { value: 'image', label: '图片' },
                  { value: 'video', label: '视频' },
                ]}
              />
              <Input
                addonBefore={t('artifact.desc')}
                value={metaForm.description ?? ''}
                onChange={(v) => setMetaForm((p) => ({ ...p, description: v }))}
              />
              {['link', 'audio', 'image', 'video'].includes(metaForm.type ?? '') && (
                <Input
                  addonBefore="URL"
                  value={metaForm.url ?? ''}
                  onChange={(v) => setMetaForm((p) => ({ ...p, url: v }))}
                />
              )}
              {metaForm.type === 'app' && (
                <Input
                  addonBefore="命令"
                  value={metaForm.command ?? ''}
                  onChange={(v) => setMetaForm((p) => ({ ...p, command: v }))}
                />
              )}
              {['file', 'audio', 'image', 'video'].includes(metaForm.type ?? '') && (
                <Input
                  addonBefore="文件名"
                  value={metaForm.fileName ?? ''}
                  onChange={(v) => setMetaForm((p) => ({ ...p, fileName: v }))}
                />
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <Text type="tertiary">{t('artifact.title')}: </Text>
                <Text>{meta.title}</Text>
              </div>
              <div>
                <Text type="tertiary">{t('artifact.icon')}: </Text>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
              </div>
              <div>
                <Text type="tertiary">{t('artifact.type')}: </Text>
                <Tag size="small">{meta.type}</Tag>
              </div>
              <div>
                <Text type="tertiary">{t('artifact.source')}: </Text>
                <Text>{meta.source.name ?? meta.source.type}</Text>
              </div>
              {meta.description && (
                <div>
                  <Text type="tertiary">{t('artifact.desc')}: </Text>
                  <Text>{meta.description}</Text>
                </div>
              )}
              {meta.contentSummary && (
                <div>
                  <Text type="tertiary">{t('artifact.contentSummary')}: </Text>
                  <Text>{meta.contentSummary}</Text>
                </div>
              )}
              {meta.externalFormat && (
                <div>
                  <Text type="tertiary">{t('artifact.externalFormat')}: </Text>
                  <Tag size="small">{meta.externalFormat}</Tag>
                </div>
              )}
              {meta.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {meta.tags.map((tag) => (
                    <Tag key={tag} size="small" type="light">
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}
              {meta.url && (
                <div>
                  <Text type="tertiary">URL: </Text>
                  <Text copyable>{meta.url}</Text>
                </div>
              )}
              {meta.command && (
                <div>
                  <Text type="tertiary">命令: </Text>
                  <Text copyable code>
                    {meta.command}
                  </Text>
                </div>
              )}
              {meta.fileName && (
                <div>
                  <Text type="tertiary">文件: </Text>
                  <Text>{meta.fileName}</Text>
                </div>
              )}
              {meta.fileSize !== undefined && (
                <div>
                  <Text type="tertiary">{t('artifact.fileSize')}: </Text>
                  <Text>{meta.fileSize}</Text>
                </div>
              )}
              {meta.mimeType && (
                <div>
                  <Text type="tertiary">MIME: </Text>
                  <Text>{meta.mimeType}</Text>
                </div>
              )}
              {meta.filePath && (
                <div>
                  <Text type="tertiary">路径: </Text>
                  <Text copyable>{meta.filePath}</Text>
                </div>
              )}
              {meta.originalFilePath && (
                <div>
                  <Text type="tertiary">{t('artifact.originalFilePath')}: </Text>
                  <Text copyable>{meta.originalFilePath}</Text>
                </div>
              )}
              {meta.repositoryOutputPath && (
                <div>
                  <Text type="tertiary">{t('artifact.repositoryOutput')}: </Text>
                  <Text copyable code>
                    {meta.repositoryOutputPath}
                  </Text>
                </div>
              )}
              {meta.repositoryPreviewPath && (
                <div>
                  <Text type="tertiary">{t('artifact.repositoryPreview')}: </Text>
                  <Text copyable code>
                    {meta.repositoryPreviewPath}
                  </Text>
                </div>
              )}
              {meta.htmlAudit && (
                <div>
                  <Text type="tertiary">{t('artifact.htmlAudit')}: </Text>
                  <Tag size="small" color={meta.htmlAudit.selfContained ? 'green' : 'red'} type="light">
                    {meta.htmlAudit.selfContained
                      ? t('artifact.htmlSelfContained')
                      : t('artifact.htmlNotSelfContained')}
                  </Tag>
                  {meta.htmlAudit.requiresApproval && (
                    <Tag size="small" color="orange" type="light" style={{ marginLeft: 4 }}>
                      {t('artifact.htmlApprovalRequired')}
                    </Tag>
                  )}
                  {meta.htmlAudit.issues.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Text type="tertiary" size="small">
                        {t('artifact.htmlIssueCount', { count: meta.htmlAudit.issues.length })}
                      </Text>
                      {meta.htmlAudit.issues.slice(0, 6).map((issue) => (
                        <Text key={`${issue.code}-${issue.detail ?? ''}`} size="small" type="secondary">
                          {issue.message}
                          {issue.detail ? `: ${issue.detail}` : ''}
                        </Text>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {meta.authEvents && meta.authEvents.length > 0 && (
                <div>
                  <Text type="tertiary">{t('artifact.runtimeAuth')}: </Text>
                  <Tag
                    size="small"
                    color={meta.authEvents[meta.authEvents.length - 1].granted ? 'green' : 'red'}
                    type="light"
                  >
                    {meta.authEvents[meta.authEvents.length - 1].granted
                      ? t('artifact.runtimeAuthGranted')
                      : t('artifact.runtimeAuthDenied')}
                  </Tag>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('artifact.runtimeAuthCount', { count: meta.authEvents.length })}
                    </Text>
                    {meta.authEvents
                      .slice(-3)
                      .reverse()
                      .map((event) => (
                        <Text key={event.id} size="small" type="secondary">
                          {event.capability} · {event.level}
                          {event.detail ? ` · ${event.detail}` : ''}
                        </Text>
                      ))}
                  </div>
                </div>
              )}
              {meta.bridgeEvents && meta.bridgeEvents.length > 0 && (
                <div>
                  <Text type="tertiary">{t('artifact.runtimeBridge')}: </Text>
                  <Tag
                    size="small"
                    color={meta.bridgeEvents[meta.bridgeEvents.length - 1].status === 'succeeded' ? 'green' : 'red'}
                    type="light"
                  >
                    {meta.bridgeEvents[meta.bridgeEvents.length - 1].status}
                  </Tag>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('artifact.runtimeBridgeCount', { count: meta.bridgeEvents.length })}
                    </Text>
                    {meta.bridgeEvents
                      .slice(-3)
                      .reverse()
                      .map((event) => (
                        <Text key={event.id} size="small" type="secondary">
                          {event.method} · {event.status}
                          {event.detail ? ` · ${event.detail}` : ''}
                          {event.resultSummary ? ` · ${event.resultSummary}` : ''}
                          {event.error ? ` · ${event.error}` : ''}
                        </Text>
                      ))}
                  </div>
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
            <Button onClick={handleCopyReference}>{t('artifact.copyReference')}</Button>
            <Button icon={<IconRefresh />} onClick={() => Toast.info(t('artifact.regenNotImplemented'))}>
              {t('artifact.regen')}
            </Button>
            {meta.source.type === 'chat' && meta.source.id && (
              <Button onClick={() => navigate(`/chat/${encodeURIComponent(meta.source.id!)}`)}>
                {t('artifact.goToChat')}
              </Button>
            )}
            <Popconfirm title={t('artifact.deleteConfirm')} onConfirm={handleDelete}>
              <Button type="danger" icon={<IconDeleteStroked />}>
                {t('artifact.delete')}
              </Button>
            </Popconfirm>
          </div>
        </Card>
      </div>
    </div>
  );
}

export { ArtifactDetailPage };
