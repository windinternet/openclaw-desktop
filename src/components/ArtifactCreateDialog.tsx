import { useState } from 'react';
import { Modal, Button, Input, Select, TextArea, Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactType } from '../lib/artifact-types';
import { getDefaultIcon } from '../lib/artifact-service';

interface Props {
  onClose: () => void;
}

export function ArtifactCreateDialog({ onClose }: Props) {
  void useTranslation();
  const generateArtifact = useStore((s) => s.generateArtifact);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ArtifactType>('other');
  const [description, setDescription] = useState('');
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await generateArtifact({
        title: title.trim(),
        type,
        description: description.trim() || undefined,
        icon: getDefaultIcon(type),
        html: html || '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title></head><body><h1>' + title + '</h1></body></html>',
        source: { type: 'manual' },
      });
      Toast.success('产物已创建');
      onClose();
    } catch (e) {
      Toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { marginBottom: 4, fontSize: 14, fontWeight: 500, color: 'var(--semi-color-text-0)' } as const;

  return (
    <Modal
      title="新建产物"
      visible
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button theme="solid" onClick={handleCreate} loading={saving} disabled={!title.trim()}>
            创建
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={labelStyle}>名称</div>
          <Input placeholder="输入产物名称" value={title} onChange={setTitle} />
        </div>
        <div>
          <div style={labelStyle}>类型</div>
          <Select value={type} onChange={(v) => setType(v as ArtifactType)}
            optionList={[
              { value: 'report', label: '📊 报告' }, { value: 'dashboard', label: '📈 仪表盘' },
              { value: 'analysis', label: '🔍 分析' }, { value: 'checklist', label: '📋 清单' },
              { value: 'code', label: '💻 代码' }, { value: 'document', label: '📄 文档' },
              { value: 'other', label: '📦 其他' },
            ]}
          />
        </div>
        <div>
          <div style={labelStyle}>描述</div>
          <Input placeholder="可选描述" value={description} onChange={setDescription} />
        </div>
        <div>
          <div style={labelStyle}>HTML 内容</div>
          <TextArea placeholder="<!DOCTYPE html>..." value={html} onChange={setHtml} rows={6} maxCount={100000} />
        </div>
      </div>
    </Modal>
  );
}
