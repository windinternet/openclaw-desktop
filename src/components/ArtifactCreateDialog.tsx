import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, Select, TextArea, TagInput, Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactType } from '../lib/artifact-types';
import { getDefaultIcon } from '../lib/artifact-service';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ALL_TYPE_OPTIONS: { value: ArtifactType; label: string }[] = [
  { value: 'report', label: '📊 报告' },
  { value: 'dashboard', label: '📈 仪表盘' },
  { value: 'analysis', label: '🔍 分析' },
  { value: 'checklist', label: '📋 清单' },
  { value: 'code', label: '💻 代码' },
  { value: 'document', label: '📄 文档' },
  { value: 'slide', label: '🖽 幻灯片' },
  { value: 'form', label: '📝 表单' },
  { value: 'other', label: '📦 其他' },
  { value: 'link', label: '🔗 链接' },
  { value: 'app', label: '🚀 应用' },
  { value: 'file', label: '📎 文件' },
  { value: 'audio', label: '🎵 音频' },
  { value: 'image', label: '🖼️ 图片' },
  { value: 'video', label: '🎬 视频' },
];

const HTML_TYPES: ArtifactType[] = [
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
];
const FILE_TYPES: ArtifactType[] = ['file', 'audio', 'image', 'video'];
const MEDIA_TYPES: ArtifactType[] = ['audio', 'image', 'video'];

export function ArtifactCreateDialog({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const generateArtifact = useStore((s) => s.generateArtifact);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ArtifactType>('other');
  const [description, setDescription] = useState('');
  const [html, setHtml] = useState('');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const prevVisible = useRef(visible);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setTitle('');
      setType('other');
      setDescription('');
      setHtml('');
      setUrl('');
      setCommand('');
      setFilePath('');
      setFileName('');
      setTags([]);
    }
    prevVisible.current = visible;
  }, [visible]);

  const isHtmlType = HTML_TYPES.includes(type);
  const isLinkType = type === 'link';
  const isAppType = type === 'app';
  const isFileType = FILE_TYPES.includes(type);
  const isMediaType = MEDIA_TYPES.includes(type);

  const canSubmit = title.trim() && (!isLinkType || url.trim()) && (!isAppType || command.trim());

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await generateArtifact({
        title: title.trim(),
        type,
        description: description.trim() || undefined,
        icon: getDefaultIcon(type),
        tags: tags.length > 0 ? tags : undefined,
        html: isHtmlType
          ? html ||
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
              title +
              '</title></head><body><h1>' +
              title +
              '</h1></body></html>'
          : undefined,
        url: isLinkType ? url.trim() : isMediaType && url ? url.trim() : undefined,
        command: isAppType ? command.trim() : undefined,
        filePath: isFileType && filePath ? filePath : undefined,
        fileName: isFileType && fileName ? fileName : undefined,
        importFile: isFileType && Boolean(filePath),
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
      visible={visible}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button theme="solid" onClick={handleCreate} loading={saving} disabled={!canSubmit}>
            {t('common.create')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={labelStyle}>{t('artifact.title')} *</div>
          <Input placeholder={t('artifact.titlePlaceholder')} value={title} onChange={setTitle} />
        </div>
        <div>
          <div style={labelStyle}>{t('artifact.type')}</div>
          <Select value={type} onChange={(v) => setType(v as ArtifactType)} optionList={ALL_TYPE_OPTIONS} />
        </div>
        <div>
          <div style={labelStyle}>{t('artifact.desc')}</div>
          <Input placeholder={t('artifact.descPlaceholder')} value={description} onChange={setDescription} />
        </div>

        {isLinkType && (
          <div>
            <div style={labelStyle}>URL *</div>
            <Input placeholder="https://..." value={url} onChange={setUrl} />
          </div>
        )}

        {isAppType && (
          <div>
            <div style={labelStyle}>命令 *</div>
            <TextArea
              placeholder="例如：npm run dev"
              value={command}
              onChange={setCommand}
              rows={3}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        )}

        {isFileType && (
          <>
            <div>
              <div style={labelStyle}>文件名</div>
              <Input placeholder="输入文件名" value={fileName} onChange={setFileName} />
            </div>
            <div>
              <div style={labelStyle}>文件路径</div>
              <Input placeholder="选择或输入文件路径" value={filePath} onChange={setFilePath} />
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                {t('artifact.importFileHint')}
              </div>
            </div>
          </>
        )}

        {isMediaType && (
          <div>
            <div style={labelStyle}>URL（可选）</div>
            <Input placeholder="输入媒体 URL" value={url} onChange={setUrl} />
          </div>
        )}

        {isHtmlType && (
          <div>
            <div style={labelStyle}>{t('artifact.htmlContent')}</div>
            <TextArea
              placeholder={t('artifact.htmlPlaceholder')}
              value={html}
              onChange={setHtml}
              rows={6}
              maxCount={100000}
            />
          </div>
        )}

        <div>
          <div style={labelStyle}>标签</div>
          <TagInput
            placeholder="输入标签后回车确认"
            value={tags}
            onChange={(v) => setTags(Array.isArray(v) ? v : [])}
          />
        </div>
      </div>
    </Modal>
  );
}
