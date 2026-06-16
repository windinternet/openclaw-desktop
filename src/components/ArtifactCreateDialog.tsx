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
  const { t } = useTranslation();
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
      Toast.success(t('artifact.created'));
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
      title={t('artifact.createTitle')}
      visible
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button theme="solid" onClick={handleCreate} loading={saving} disabled={!title.trim()}>
            {t('common.create')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={labelStyle}>{t('artifact.title')}</div>
          <Input placeholder={t('artifact.titlePlaceholder')} value={title} onChange={setTitle} />
        </div>
        <div>
          <div style={labelStyle}>{t('artifact.type')}</div>
          <Select value={type} onChange={(v) => setType(v as ArtifactType)}
            optionList={[
              { value: 'report', label: t('artifact.typeLabelReport') }, { value: 'dashboard', label: t('artifact.typeLabelDashboard') },
              { value: 'analysis', label: t('artifact.typeLabelAnalysis') }, { value: 'checklist', label: t('artifact.typeLabelChecklist') },
              { value: 'code', label: t('artifact.typeLabelCode') }, { value: 'document', label: t('artifact.typeLabelDoc') },
              { value: 'other', label: t('artifact.typeLabelOther') },
            ]}
          />
        </div>
        <div>
          <div style={labelStyle}>{t('artifact.desc')}</div>
          <Input placeholder={t('artifact.descPlaceholder')} value={description} onChange={setDescription} />
        </div>
        <div>
          <div style={labelStyle}>{t('artifact.htmlContent')}</div>
          <TextArea placeholder={t('artifact.htmlPlaceholder')} value={html} onChange={setHtml} rows={6} maxCount={100000} />
        </div>
      </div>
    </Modal>
  );
}
