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
  void useTranslation();
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
    if (status === 'draft') return '草稿';
    if (status === 'published') return '已发布';
    return '已归档';
  };

  const handleSaveMeta = async () => {
    if (!artifactId) return;
    await updateArtifact(artifactId, metaForm);
    setEditingMeta(false);
    Toast.success('已保存');
  };

  const handleDelete = async () => {
    if (!artifactId) return;
    await deleteArtifact(artifactId);
    navigate('/artifacts');
    Toast.success('已删除');
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
        <Button icon={<IconPlay />} theme="solid" onClick={() => openArtifactWindow(meta.id)}>查看</Button>
        {meta.status !== 'published' && (
          <Button onClick={() => { updateArtifact(meta.id, { status: 'published' }); }}>发布</Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Card title="元数据"
          headerExtraContent={
            <Button size="small" onClick={() => editingMeta ? handleSaveMeta() : setEditingMeta(true)}>
              {editingMeta ? '保存' : '编辑'}
            </Button>
          }
        >
          {editingMeta ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input addonBefore="名称" value={metaForm.title ?? ''} onChange={(v) => setMetaForm((p) => ({ ...p, title: v }))} />
              <Input addonBefore="图标" value={metaForm.icon ?? ''} onChange={(v) => setMetaForm((p) => ({ ...p, icon: v }))} />
              <Select value={metaForm.type} onChange={(v) => setMetaForm((p) => ({ ...p, type: v as ArtifactMeta['type'] }))}
                optionList={[
                  { value: 'report', label: '报告' }, { value: 'dashboard', label: '仪表盘' },
                  { value: 'analysis', label: '分析' }, { value: 'checklist', label: '清单' },
                  { value: 'code', label: '代码' }, { value: 'document', label: '文档' },
                  { value: 'other', label: '其他' },
                ]}
              />
              <Input addonBefore="描述" value={metaForm.description ?? ''} onChange={(v) => setMetaForm((p) => ({ ...p, description: v }))} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><Text type="tertiary">名称: </Text><Text>{meta.title}</Text></div>
              <div><Text type="tertiary">图标: </Text><span style={{ fontSize: 20 }}>{meta.icon}</span></div>
              <div><Text type="tertiary">类型: </Text><Tag size="small">{meta.type}</Tag></div>
              <div><Text type="tertiary">来源: </Text><Text>{meta.source.name ?? meta.source.type}</Text></div>
              {meta.description && <div><Text type="tertiary">描述: </Text><Text>{meta.description}</Text></div>}
              {meta.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {meta.tags.map((tag) => <Tag key={tag} size="small" type="light">{tag}</Tag>)}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="版本历史">
          <Empty title="暂无版本" />
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Card title="操作">
          <div style={{ display: 'flex', gap: 12 }}>
            <Button icon={<IconRefresh />} onClick={() => Toast.info('重新生成即将支持')}>
              基于此重新生成
            </Button>
            {meta.source.type === 'chat' && meta.source.id && (
              <Button onClick={() => navigate(`/chat/${encodeURIComponent(meta.source.id!)}`)}>
                跳转到来源会话
              </Button>
            )}
            <Popconfirm title="确认删除产物？" onConfirm={handleDelete}>
              <Button type="danger" icon={<IconDeleteStroked />}>删除产物</Button>
            </Popconfirm>
          </div>
        </Card>
      </div>
    </div>
  );
}

export { ArtifactDetailPage };
