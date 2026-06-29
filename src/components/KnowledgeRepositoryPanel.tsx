import { type DragEvent, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconBolt, IconFile, IconLink, IconPlus, IconSearch, IconTickCircle, IconUpload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway, useStore } from '../lib';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type { RepositoryBinding } from '../lib/agentic-repository';
import type { DashboardTailActionRouteContext } from '../lib/dashboard-tail-action-routing';
import type {
  KnowledgeDocument,
  KnowledgeFileExtractionMetadata,
  KnowledgeSnapshot,
  RepositoryGitLogEntry,
  RepositoryMarkdownFile,
  RepositorySearchResult,
} from '../lib/repository-knowledge';
import {
  buildKnowledgeRewritePrompt,
  buildKnowledgeTailActionRewriteInstruction,
  importKnowledgeFileSource,
  importKnowledgeFolderSource,
  importKnowledgeTextSource,
  importKnowledgeUrlSource,
  loadKnowledgeDocumentHistory,
  loadKnowledgeSnapshot,
  readKnowledgeDocument,
  searchKnowledge,
  writeKnowledgeHealthReview,
} from '../lib/repository-knowledge';
import { KNOWLEDGE_IMPORT_ACCEPT, resolveKnowledgeImportFileKind } from '../lib/knowledge-file-import';
import { confirmWorkbenchKnowledgeTailAction } from '../lib/repository-workbench';
import { useWorkbenchWorkItemOptions } from '../lib/workbench-work-items';
import { ActionRunWorkItemPicker } from './ActionRunWorkItemPicker';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

interface KnowledgeImportedFileContent {
  body: string;
  mimeType?: string;
  extracted?: KnowledgeFileExtractionMetadata;
}

export type KnowledgeSection =
  | 'dashboard'
  | 'entries'
  | 'wiki'
  | 'sources'
  | 'digest'
  | 'recent'
  | 'relationships'
  | 'health'
  | 'index'
  | 'log';

interface KnowledgeRewriteOptions {
  userInstruction?: string;
  workItemId?: string;
  workItemPath?: string;
  tailActionId?: string;
}

export default function KnowledgeRepositoryPanel({
  binding,
  section,
  tailActionContext,
}: {
  binding: RepositoryBinding;
  section?: KnowledgeSection;
  tailActionContext?: DashboardTailActionRouteContext | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeClient = useStore((s) => s.activeClient);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const agents = useStore((s) => s.agents);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepositorySearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [tailActionConfirming, setTailActionConfirming] = useState(false);
  const [tailActionConfirmed, setTailActionConfirmed] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [healthReviewLoading, setHealthReviewLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [documentHistory, setDocumentHistory] = useState<RepositoryGitLogEntry[]>([]);
  const [activeSection, setActiveSection] = useState<KnowledgeSection>(section ?? 'wiki');
  const [showImportText, setShowImportText] = useState(false);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [dragImportActive, setDragImportActive] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importBody, setImportBody] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importUrlTitle, setImportUrlTitle] = useState('');
  const [importUrlNote, setImportUrlNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const knowledgeTailActionContext = tailActionContext?.kind === 'knowledge' ? tailActionContext : null;
  const knowledgeTailActionCanConfirm = Boolean(
    knowledgeTailActionContext?.id && knowledgeTailActionContext.id.includes(':tail-action:'),
  );
  const knowledgeTailActionRunId = knowledgeTailActionContext?.id?.startsWith('action-run-knowledge:')
    ? knowledgeTailActionContext.id
    : undefined;
  const {
    createWorkItem: createKnowledgeWorkItem,
    creating: creatingKnowledgeWorkItem,
    loading: knowledgeWorkItemLoading,
    options: workItemOptions,
    selectedPath: selectedKnowledgeWorkItemPath,
    setSelectedPath: setSelectedKnowledgeWorkItemPath,
    selectedWorkItem: selectedKnowledgeWorkItem,
    selectedWorkItemId: selectedKnowledgeWorkItemId,
  } = useWorkbenchWorkItemOptions({
    binding,
    enabled: !knowledgeTailActionContext?.workItemPath,
  });

  useEffect(() => {
    setTailActionConfirmed(false);
  }, [knowledgeTailActionContext?.id, knowledgeTailActionContext?.workItemPath]);

  useEffect(() => {
    if (section) setActiveSection(section);
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadKnowledgeSnapshot(binding)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [binding]);

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      setResults(await searchKnowledge(binding, query));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const openDocument = async (path: string) => {
    setDocumentLoading(true);
    setHistoryLoading(true);
    setError(null);
    try {
      const [document, history] = await Promise.all([
        readKnowledgeDocument(binding, path),
        loadKnowledgeDocumentHistory(binding, path, 8),
      ]);
      setSelectedDocument(document);
      setDocumentHistory(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDocumentLoading(false);
      setHistoryLoading(false);
    }
  };

  const openFile = (file: RepositoryMarkdownFile) => {
    void openDocument(file.path);
  };

  const handleImportTextSource = async () => {
    if (!importBody.trim()) {
      Toast.warning(t('knowledge.importTextRequired'));
      return;
    }
    setImportLoading(true);
    setError(null);
    try {
      const imported = await importKnowledgeTextSource(binding, {
        title: importTitle,
        body: importBody,
      });
      const nextSnapshot = await loadKnowledgeSnapshot(binding);
      setSnapshot(nextSnapshot);
      setImportTitle('');
      setImportBody('');
      setShowImportText(false);
      setActiveSection('digest');
      await openDocument(imported.path);
      Toast.success(t('knowledge.importTextDone'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('knowledge.importTextFailed'));
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportUrlSource = async () => {
    if (!importUrl.trim()) {
      Toast.warning(t('knowledge.importUrlRequired'));
      return;
    }
    setImportLoading(true);
    setError(null);
    try {
      const imported = await importKnowledgeUrlSource(binding, {
        title: importUrlTitle,
        url: importUrl,
        note: importUrlNote,
      });
      const nextSnapshot = await loadKnowledgeSnapshot(binding);
      setSnapshot(nextSnapshot);
      setImportUrl('');
      setImportUrlTitle('');
      setImportUrlNote('');
      setShowImportUrl(false);
      setActiveSection('digest');
      await openDocument(imported.path);
      Toast.success(t('knowledge.importUrlDone'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('knowledge.importUrlFailed'));
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportFiles = async (files: FileList | File[] | null, mode: 'files' | 'folder' = 'files') => {
    const selectedFiles = Array.from(files ?? []).filter(isKnowledgeSupportedImportFile);
    if (selectedFiles.length === 0) {
      Toast.warning(t('knowledge.importUnsupportedFile'));
      return;
    }

    setImportLoading(true);
    setError(null);
    try {
      let lastImportedPath: string | undefined;
      for (const file of selectedFiles) {
        const fileContent = await readKnowledgeImportedFileContent(file);
        const imported =
          mode === 'folder'
            ? await importKnowledgeFolderSource(binding, {
                fileName: file.name,
                relativePath: getKnowledgeFolderRelativePath(file),
                mimeType: fileContent.mimeType,
                body: fileContent.body,
                extracted: fileContent.extracted,
              })
            : await importKnowledgeFileSource(binding, {
                fileName: file.name,
                mimeType: fileContent.mimeType,
                body: fileContent.body,
                extracted: fileContent.extracted,
              });
        lastImportedPath = imported.path;
      }
      const nextSnapshot = await loadKnowledgeSnapshot(binding);
      setSnapshot(nextSnapshot);
      setActiveSection('digest');
      if (lastImportedPath) await openDocument(lastImportedPath);
      Toast.success(
        t(mode === 'folder' ? 'knowledge.importFolderDone' : 'knowledge.importFileDone', {
          count: selectedFiles.length,
        }),
      );
    } catch (err) {
      Toast.error(
        err instanceof Error
          ? err.message
          : t(mode === 'folder' ? 'knowledge.importFolderFailed' : 'knowledge.importFileFailed'),
      );
    } finally {
      setImportLoading(false);
      if (mode === 'folder') {
        if (folderInputRef.current) folderInputRef.current.value = '';
      } else if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const readKnowledgeImportedFileContent = async (file: File): Promise<KnowledgeImportedFileContent> => {
    const mimeType = file.type || undefined;
    const fileKind = resolveKnowledgeImportFileKind({ name: file.name, type: mimeType });
    if (fileKind.kind === 'text') {
      return { body: await file.text(), mimeType };
    }
    if (fileKind.kind === 'unsupported') {
      throw new Error(t('knowledge.importUnsupportedFile', { name: file.name }));
    }

    const extractKnowledgeFileText = window.electronAPI.repository?.extractKnowledgeFileText;
    if (!extractKnowledgeFileText) {
      throw new Error(t('knowledge.importExtractedFileUnsupportedRuntime'));
    }

    const extracted = await extractKnowledgeFileText({
      fileName: file.name,
      mimeType,
      bytes: await file.arrayBuffer(),
    });
    if (!extracted.text.trim()) {
      throw new Error(t('knowledge.importExtractedFileEmpty', { name: file.name }));
    }

    return {
      body: extracted.text,
      mimeType,
      extracted: {
        format: extracted.format,
        status: 'best_effort',
        bytesRead: extracted.bytesRead,
        truncated: extracted.truncated,
        limitations: ['PDF/Office 文本抽取为 best-effort：会保留可读取文字，复杂版式、图片和公式可能丢失。'],
      },
    };
  };

  const handleImportDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragImportActive(true);
  };

  const handleImportDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragImportActive(false);
  };

  const handleImportDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragImportActive(false);
    void handleImportFiles(event.dataTransfer.files);
  };

  const handleWriteHealthReview = async () => {
    const health = snapshot?.health;
    if (!health) return;

    setHealthReviewLoading(true);
    setError(null);
    try {
      const review = await writeKnowledgeHealthReview(binding, { health });
      await openDocument(review.path);
      setActiveSection('recent');
      Toast.success(t('knowledge.healthReviewWritten'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('knowledge.healthReviewFailed'));
    } finally {
      setHealthReviewLoading(false);
    }
  };

  const handleKnowledgeRewrite = async (
    intent: 'digest-source' | 'refresh-index' | 'update-selected',
    selectedPathOverride?: string,
    options: KnowledgeRewriteOptions = {},
  ) => {
    if (!activeClient || !currentInstanceId) {
      Toast.error(t('knowledge.rewriteNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('knowledge.rewriteNoAgent'));
      return;
    }

    const selectedPath = selectedPathOverride ?? selectedDocument?.path;
    const sourcePath =
      intent === 'digest-source'
        ? selectedPath
        : selectedDocument?.sourceType === 'sources'
          ? selectedDocument.path
          : undefined;
    const resolvedWorkItemPath = options.workItemPath || selectedKnowledgeWorkItem?.path;
    const resolvedWorkItemId = options.workItemId || selectedKnowledgeWorkItemId;
    setRewriteLoading(true);
    try {
      const input = [
        intent === 'digest-source'
          ? t('knowledge.digestSource')
          : intent === 'update-selected'
            ? t('knowledge.updateSelected')
            : t('knowledge.refreshIndexLog'),
        selectedPath ? `path: ${selectedPath}` : '',
        resolvedWorkItemPath ? `${t('knowledge.tailActionSource')}: ${resolvedWorkItemPath}` : '',
        options.tailActionId ? `tailActionId: ${options.tailActionId}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const actionRun = createAiActionRun({
        type: 'knowledge_rewrite',
        sourcePage: 'knowledge',
        instanceId: currentInstanceId,
        agentId: agent.id,
        executionMode: 'isolated-session',
        input,
        workItemId: resolvedWorkItemId,
        workItemPath: resolvedWorkItemPath,
      });
      await upsertAiActionRun(currentInstanceId, { ...actionRun, status: 'planning', updatedAt: Date.now() });
      const runningRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: t('knowledge.rewriteActionTitle'),
        prompt: buildKnowledgeRewritePrompt({
          binding,
          intent,
          selectedPath,
          sourcePath,
          userInstruction: options.userInstruction,
        }),
      });
      await upsertAiActionRun(currentInstanceId, runningRun);

      let latestRun = runningRun;
      for (let index = 0; index < 4; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latestRun = await syncAiActionRunWithGateway(activeClient, latestRun);
        await upsertAiActionRun(currentInstanceId, latestRun);
        if (latestRun.status === 'awaiting_approval' || latestRun.status === 'done' || latestRun.status === 'failed')
          break;
      }

      Toast.success(t('knowledge.rewriteStarted'));
      navigate('/actions');
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('knowledge.rewriteFailed'));
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleKnowledgeTailActionRewrite = () => {
    if (!knowledgeTailActionContext?.workItemPath) {
      Toast.warning(t('knowledge.tailActionRewriteUnavailable'));
      return;
    }

    void handleKnowledgeRewrite('refresh-index', undefined, {
      userInstruction: buildKnowledgeTailActionRewriteInstruction({
        workItemPath: knowledgeTailActionContext.workItemPath,
        tailActionId: knowledgeTailActionContext.id,
      }),
      workItemPath: knowledgeTailActionContext.workItemPath,
      tailActionId: knowledgeTailActionContext.id,
    });
  };

  const handleConfirmKnowledgeTailAction = async () => {
    const workItemPath = knowledgeTailActionContext?.workItemPath;
    const tailActionId = knowledgeTailActionContext?.id;
    if (!workItemPath || !tailActionId) {
      Toast.warning(t('knowledge.tailActionConfirmUnavailable'));
      return;
    }

    setTailActionConfirming(true);
    try {
      const confirmed = await confirmWorkbenchKnowledgeTailAction(binding, {
        workItemPath,
        tailActionId,
      });
      if (!confirmed) {
        Toast.warning(t('knowledge.tailActionConfirmUnavailable'));
        return;
      }
      setTailActionConfirmed(true);
      Toast.success(t('knowledge.tailActionConfirmed'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('knowledge.tailActionConfirmFailed'));
    } finally {
      setTailActionConfirming(false);
    }
  };

  const renderFileButton = (file: RepositoryMarkdownFile) => (
    <button
      key={file.path}
      type="button"
      onClick={() => openFile(file)}
      style={{
        width: '100%',
        border:
          selectedDocument?.path === file.path
            ? '1px solid var(--semi-color-primary)'
            : '1px solid var(--semi-color-border)',
        background:
          selectedDocument?.path === file.path ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
        borderRadius: 6,
        padding: '8px 10px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
        {file.name}
      </Text>
      <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
        {file.path}
      </Text>
    </button>
  );

  const renderFileList = (files: RepositoryMarkdownFile[], emptyText: string) =>
    files.length > 0 ? (
      <Space vertical align="start" style={{ width: '100%' }}>
        {files.map(renderFileButton)}
      </Space>
    ) : (
      <Empty description={emptyText} />
    );

  const renderDigestQueue = () => {
    const queue = snapshot?.undigestedSources ?? [];
    if (queue.length === 0) return <Empty description={t('knowledge.emptyDigestQueue')} />;

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        {queue.map((file) => (
          <div
            key={file.path}
            role="button"
            tabIndex={0}
            onClick={() => openFile(file)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') openFile(file);
            }}
            style={{
              width: '100%',
              border:
                selectedDocument?.path === file.path
                  ? '1px solid var(--semi-color-primary)'
                  : '1px solid var(--semi-color-border)',
              background:
                selectedDocument?.path === file.path
                  ? 'var(--semi-color-primary-light-default)'
                  : 'var(--semi-color-bg-0)',
              borderRadius: 6,
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <span style={{ minWidth: 0 }}>
                <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {file.name}
                </Text>
                <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {file.path}
                </Text>
              </span>
              <Button
                size="small"
                icon={<IconBolt />}
                loading={rewriteLoading}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleKnowledgeRewrite('digest-source', file.path);
                }}
              >
                {t('knowledge.digestThisSource')}
              </Button>
            </Space>
          </div>
        ))}
      </Space>
    );
  };

  const renderEntryList = () =>
    snapshot?.indexEntries && snapshot.indexEntries.length > 0 ? (
      <Space vertical align="start" style={{ width: '100%' }}>
        {snapshot.indexEntries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            onClick={() => void openDocument(entry.path)}
            style={{
              width: '100%',
              border:
                selectedDocument?.path === entry.path
                  ? '1px solid var(--semi-color-primary)'
                  : '1px solid var(--semi-color-border)',
              background:
                selectedDocument?.path === entry.path
                  ? 'var(--semi-color-primary-light-default)'
                  : 'var(--semi-color-bg-0)',
              borderRadius: 6,
              padding: '9px 10px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Space align="center" wrap>
              <Tag color={entry.kind === 'source' ? 'blue' : 'green'} size="small">
                {entry.kind === 'source' ? t('knowledge.kindSource') : t('knowledge.kindWiki')}
              </Tag>
              <Text strong>{entry.title}</Text>
            </Space>
            {entry.summary ? (
              <Text
                type="tertiary"
                size="small"
                ellipsis={{ showTooltip: true }}
                style={{ display: 'block', marginTop: 6 }}
              >
                {entry.summary}
              </Text>
            ) : null}
            <Text
              type="tertiary"
              size="small"
              ellipsis={{ showTooltip: true }}
              style={{ display: 'block', marginTop: 4 }}
            >
              {entry.path}
            </Text>
          </button>
        ))}
      </Space>
    ) : (
      <Empty description={t('common.noData')} />
    );

  const renderRelationships = () => {
    const hasRelationships = (snapshot?.backlinks.length ?? 0) + (snapshot?.relatedRepositoryLinks.length ?? 0) > 0;
    if (!hasRelationships) return <Empty description={t('knowledge.emptyRelationships')} />;

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        {snapshot?.backlinks && snapshot.backlinks.length > 0 && (
          <Space vertical align="start" style={{ width: '100%' }}>
            <Text strong>{t('knowledge.backlinks')}</Text>
            {snapshot.backlinks.map((link) => (
              <button
                key={`${link.sourcePath}->${link.targetPath}`}
                type="button"
                onClick={() => void openDocument(link.sourcePath)}
                style={{
                  width: '100%',
                  border: '1px solid var(--semi-color-border)',
                  background: 'var(--semi-color-bg-0)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {link.sourcePath}
                </Text>
                <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {link.targetPath}
                </Text>
              </button>
            ))}
          </Space>
        )}
        {snapshot?.relatedRepositoryLinks && snapshot.relatedRepositoryLinks.length > 0 && (
          <Space vertical align="start" style={{ width: '100%' }}>
            <Text strong>{t('knowledge.relatedLinks')}</Text>
            {snapshot.relatedRepositoryLinks.map((link) => (
              <button
                key={`${link.sourcePath}->${link.targetPath}`}
                type="button"
                onClick={() => void openDocument(link.sourcePath)}
                style={{
                  width: '100%',
                  border: '1px solid var(--semi-color-border)',
                  background: 'var(--semi-color-bg-0)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Tag size="small" color={link.type === 'work' ? 'orange' : 'purple'}>
                  {link.type}
                </Tag>
                <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>
                  {link.sourcePath}
                </Text>
                <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {link.targetPath}
                </Text>
              </button>
            ))}
          </Space>
        )}
      </Space>
    );
  };

  const renderNavigator = () => {
    if (activeSection === 'dashboard') return renderEntryList();
    if (activeSection === 'entries') return renderEntryList();
    if (activeSection === 'wiki') return renderFileList(snapshot?.wiki ?? [], t('knowledge.emptyWiki'));
    if (activeSection === 'sources') return renderFileList(snapshot?.sources ?? [], t('knowledge.emptySources'));
    if (activeSection === 'digest') return renderDigestQueue();
    if (activeSection === 'recent') return renderFileList(snapshot?.recentFiles ?? [], t('common.noData'));
    if (activeSection === 'relationships') return renderRelationships();
    if (activeSection === 'health') return renderHealthIssues();
    return (
      <Empty
        title={activeSection === 'index' ? t('knowledge.index') : t('knowledge.log')}
        description={activeSection === 'index' ? t('knowledge.indexEntries') : t('knowledge.recentUpdates')}
      />
    );
  };

  const renderReader = () => (
    <Card
      style={{ minWidth: 0 }}
      bodyStyle={{
        minHeight: 460,
        maxHeight: 'calc(100vh - 300px)',
        overflow: 'auto',
      }}
    >
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
        <Title heading={5} style={{ margin: 0 }}>
          {activeSection === 'index'
            ? t('knowledge.index')
            : activeSection === 'log'
              ? t('knowledge.log')
              : t('knowledge.selectedDocument')}
        </Title>
        {selectedDocument?.sourceType && activeSection !== 'index' && activeSection !== 'log' && (
          <Tag color={selectedDocument.sourceType === 'sources' ? 'blue' : 'green'}>
            {selectedDocument.sourceType === 'sources' ? t('knowledge.sources') : t('knowledge.wiki')}
          </Tag>
        )}
      </Space>
      {documentLoading ? (
        <Spin />
      ) : activeSection === 'index' ? (
        <MarkdownView content={snapshot?.indexMarkdown ?? ''} />
      ) : activeSection === 'log' ? (
        <MarkdownView content={snapshot?.logMarkdown ?? ''} />
      ) : selectedDocument ? (
        <>
          <Text type="tertiary" size="small">
            {selectedDocument.path}
          </Text>
          <div
            style={{
              border: '1px solid var(--semi-color-border)',
              borderRadius: 8,
              padding: 12,
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
              <Text strong>{t('knowledge.gitHistory')}</Text>
              {historyLoading && <Spin size="small" />}
            </Space>
            {documentHistory.length > 0 ? (
              <Space vertical align="start" style={{ width: '100%' }}>
                {documentHistory.map((entry) => (
                  <div key={entry.hash} style={{ width: '100%' }}>
                    <Space align="center" wrap>
                      <Tag color="grey">{entry.shortHash}</Tag>
                      <Text size="small" type="tertiary">
                        {entry.date}
                      </Text>
                      <Text size="small" type="tertiary">
                        {entry.author}
                      </Text>
                    </Space>
                    <Text size="small" style={{ display: 'block', marginTop: 4 }}>
                      {entry.subject}
                    </Text>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="tertiary" size="small">
                {t('knowledge.gitHistoryEmpty')}
              </Text>
            )}
          </div>
          <MarkdownView content={selectedDocument.content} />
        </>
      ) : (
        <Empty description={t('knowledge.previewEmpty')} />
      )}
    </Card>
  );

  const renderSearchResults = () =>
    results.length > 0 && (
      <Card style={{ width: '100%' }} bodyStyle={{ padding: 12 }}>
        <Text strong>{t('knowledge.searchResults')}</Text>
        <Space vertical align="start" style={{ width: '100%', marginTop: 8 }}>
          {results.map((result) => (
            <button
              key={`${result.path}:${result.line}`}
              type="button"
              onClick={() => void openDocument(result.path)}
              style={{
                width: '100%',
                border: '1px solid var(--semi-color-border)',
                background: 'var(--semi-color-bg-0)',
                borderRadius: 6,
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Space align="center">
                {result.sourceType && (
                  <Tag size="small">
                    {result.sourceType === 'sources' ? t('knowledge.sources') : t('knowledge.wiki')}
                  </Tag>
                )}
                <Text strong size="small">
                  {result.line}
                </Text>
              </Space>
              <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>
                {result.path}
              </Text>
              <Text
                type="tertiary"
                size="small"
                ellipsis={{ showTooltip: true }}
                style={{ display: 'block', marginTop: 4 }}
              >
                {result.snippet}
              </Text>
            </button>
          ))}
        </Space>
      </Card>
    );

  const renderDashboard = () => {
    const relationshipCount = (snapshot?.backlinks.length ?? 0) + (snapshot?.relatedRepositoryLinks.length ?? 0);
    const hasEntries = Boolean(snapshot?.indexEntries && snapshot.indexEntries.length > 0);
    const stats = [
      { label: t('knowledge.sources'), value: snapshot?.sources.length ?? 0, color: 'blue' as const },
      { label: t('knowledge.wiki'), value: snapshot?.wiki.length ?? 0, color: 'green' as const },
      { label: t('knowledge.digestQueue'), value: snapshot?.undigestedSources.length ?? 0, color: 'orange' as const },
      { label: t('knowledge.recentUpdates'), value: snapshot?.recentFiles.length ?? 0, color: 'grey' as const },
      { label: t('knowledge.relationships'), value: relationshipCount, color: 'orange' as const },
    ];

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 0.85fr) minmax(0, 1.15fr)',
          gap: 16,
          width: '100%',
          alignItems: 'start',
        }}
      >
        <Card bodyStyle={{ minHeight: 460 }}>
          <Title heading={5} style={{ marginTop: 0 }}>
            {t('knowledge.dashboard')}
          </Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            {stats.map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'var(--semi-color-bg-0)',
                }}
              >
                <Tag color={item.color}>{item.label}</Tag>
                <Title heading={4} style={{ margin: '8px 0 0' }}>
                  {item.value}
                </Title>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: 12 }}>
            <Title heading={6} style={{ marginTop: 0 }}>
              {t('knowledge.recentUpdates')}
            </Title>
            {renderFileList(snapshot?.recentFiles.slice(0, 5) ?? [], t('common.noData'))}
          </div>
          <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: 12, marginTop: 12 }}>
            <Title heading={6} style={{ marginTop: 0 }}>
              {t('knowledge.health')}
            </Title>
            {renderHealthIssues(3)}
          </div>
        </Card>
        <Card bodyStyle={{ minHeight: 460 }}>
          <Title heading={5} style={{ marginTop: 0 }}>
            {hasEntries ? t('knowledge.indexEntries') : t('knowledge.wiki')}
          </Title>
          {hasEntries ? renderEntryList() : renderFileList(snapshot?.wiki.slice(0, 8) ?? [], t('knowledge.emptyWiki'))}
        </Card>
      </div>
    );
  };

  const renderHealthIssues = (limit?: number) => {
    const issues = snapshot?.health.issues ?? [];
    const visibleIssues = limit ? issues.slice(0, limit) : issues;
    if (visibleIssues.length === 0) return <Empty description={t('knowledge.noHealthIssues')} />;

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        {visibleIssues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            onClick={() => void openDocument(issue.path)}
            style={{
              width: '100%',
              border: '1px solid var(--semi-color-border)',
              background: 'var(--semi-color-bg-0)',
              borderRadius: 6,
              padding: '8px 10px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Space align="center" wrap>
              <Tag color={issue.severity === 'critical' ? 'red' : issue.severity === 'warning' ? 'orange' : 'blue'}>
                {issue.severity}
              </Tag>
              <Text strong size="small">
                {issue.title}
              </Text>
            </Space>
            <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>
              {issue.path}
            </Text>
            {issue.targetPath ? (
              <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                {issue.targetPath}
              </Text>
            ) : null}
            <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
              {issue.detail}
            </Text>
          </button>
        ))}
      </Space>
    );
  };

  if (loading) return <Spin />;
  if (error) return <Empty title={t('common.failed')} description={error} />;

  return (
    <div
      onDragOver={handleImportDragOver}
      onDragLeave={handleImportDragLeave}
      onDrop={handleImportDrop}
      style={{ width: '100%', position: 'relative' }}
    >
      {dragImportActive ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            minHeight: 220,
            border: '2px dashed var(--semi-color-primary)',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--semi-color-primary-light-default) 72%, var(--semi-color-bg-0))',
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <Space vertical align="center" spacing={8}>
            <IconUpload size="extra-large" />
            <Text strong>{t('knowledge.dropFilesToImport')}</Text>
            <Text type="tertiary" size="small">
              {t('knowledge.dropFilesToImportDesc')}
            </Text>
          </Space>
        </div>
      ) : null}
      <Space vertical align="start" style={{ width: '100%' }} spacing={16}>
        {knowledgeTailActionContext ? (
          <div
            style={{
              width: '100%',
              border: '1px solid var(--semi-color-border)',
              borderRadius: 8,
              padding: 12,
              background: 'var(--semi-color-fill-0)',
            }}
          >
            <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Tag color="green" size="small">
                  {t('knowledge.tailActionContextTitle')}
                </Tag>
                <Text size="small" style={{ display: 'block', marginTop: 8 }}>
                  {t('knowledge.tailActionRewriteDesc')}
                </Text>
                {knowledgeTailActionContext.workItemPath ? (
                  <Text
                    type="tertiary"
                    size="small"
                    ellipsis={{ showTooltip: true }}
                    style={{ display: 'block', marginTop: 4 }}
                  >
                    {t('knowledge.tailActionSource')}: {knowledgeTailActionContext.workItemPath}
                  </Text>
                ) : null}
                {knowledgeTailActionRunId ? (
                  <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                    {t('knowledge.tailActionRunSource')}: {knowledgeTailActionRunId}
                  </Text>
                ) : null}
              </div>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<IconBolt />}
                  loading={rewriteLoading}
                  disabled={!knowledgeTailActionContext.workItemPath}
                  onClick={handleKnowledgeTailActionRewrite}
                >
                  {t('knowledge.startTailActionRewrite')}
                </Button>
                {knowledgeTailActionCanConfirm ? (
                  <Button
                    type="secondary"
                    icon={<IconTickCircle />}
                    loading={tailActionConfirming}
                    disabled={
                      !knowledgeTailActionContext.workItemPath || !knowledgeTailActionContext.id || tailActionConfirmed
                    }
                    onClick={() => void handleConfirmKnowledgeTailAction()}
                  >
                    {tailActionConfirmed ? t('knowledge.tailActionConfirmed') : t('knowledge.confirmTailAction')}
                  </Button>
                ) : null}
              </Space>
            </Space>
          </div>
        ) : null}

        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space wrap>
            <Tag color="blue">{t('knowledge.sourceCount', { count: snapshot?.sources.length ?? 0 })}</Tag>
            <Tag color="green">{t('knowledge.wikiCount', { count: snapshot?.wiki.length ?? 0 })}</Tag>
          </Space>
          <Space wrap>
            {!knowledgeTailActionContext ? (
              <ActionRunWorkItemPicker
                description={t('knowledge.rewriteWorkItemDesc')}
                selectPlaceholder={t('knowledge.rewriteWorkItemPlaceholder')}
                createLabel={t('knowledge.rewriteNewWorkItem')}
                createPlaceholder={t('knowledge.rewriteNewWorkItemPlaceholder')}
                createSuccessMessage={t('knowledge.rewriteNewWorkItemSuccess')}
                options={workItemOptions}
                selectedPath={selectedKnowledgeWorkItemPath}
                onSelectedPathChange={setSelectedKnowledgeWorkItemPath}
                createWorkItem={createKnowledgeWorkItem}
                disabled={rewriteLoading}
                creating={creatingKnowledgeWorkItem}
                loading={knowledgeWorkItemLoading}
                size="small"
                style={{ minWidth: 280, maxWidth: 360 }}
              />
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept={KNOWLEDGE_IMPORT_ACCEPT}
              multiple
              style={{ display: 'none' }}
              onChange={(event) => void handleImportFiles(event.currentTarget.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              accept={KNOWLEDGE_IMPORT_ACCEPT}
              multiple
              style={{ display: 'none' }}
              onChange={(event) => void handleImportFiles(event.currentTarget.files, 'folder')}
              {...{ webkitdirectory: '', directory: '' }}
            />
            <Button icon={<IconPlus />} onClick={() => setShowImportText(true)}>
              {t('knowledge.importTextSource')}
            </Button>
            <Button icon={<IconUpload />} loading={importLoading} onClick={() => fileInputRef.current?.click()}>
              {t('knowledge.importFileSource')}
            </Button>
            <Button icon={<IconUpload />} loading={importLoading} onClick={() => folderInputRef.current?.click()}>
              {t('knowledge.importFolderSource')}
            </Button>
            <Button icon={<IconLink />} onClick={() => setShowImportUrl(true)}>
              {t('knowledge.importUrlSource')}
            </Button>
            <Button
              icon={<IconBolt />}
              loading={rewriteLoading}
              disabled={!selectedDocument || selectedDocument.sourceType !== 'sources'}
              onClick={() => void handleKnowledgeRewrite('digest-source')}
            >
              {t('knowledge.digestSource')}
            </Button>
            <Button
              icon={<IconFile />}
              loading={rewriteLoading}
              disabled={!selectedDocument}
              onClick={() =>
                void handleKnowledgeRewrite(
                  selectedDocument?.sourceType === 'sources' ? 'digest-source' : 'update-selected',
                )
              }
            >
              {t('knowledge.updateSelected')}
            </Button>
            <Button loading={rewriteLoading} onClick={() => void handleKnowledgeRewrite('refresh-index')}>
              {t('knowledge.refreshIndexLog')}
            </Button>
          </Space>
        </Space>

        <Space wrap style={{ width: '100%' }}>
          <Input
            value={query}
            onChange={setQuery}
            placeholder={t('knowledge.searchPlaceholder')}
            style={{ minWidth: 320, flex: 1 }}
            onEnterPress={handleSearch}
          />
          <Button icon={<IconSearch />} loading={searching} onClick={handleSearch}>
            {t('common.search')}
          </Button>
        </Space>

        {activeSection === 'dashboard' ? (
          renderDashboard()
        ) : activeSection === 'index' || activeSection === 'log' ? (
          <>
            {renderSearchResults()}
            {renderReader()}
          </>
        ) : activeSection === 'health' ? (
          <Card style={{ width: '100%' }}>
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
              <Title heading={5} style={{ margin: 0 }}>
                {t('knowledge.health')}
              </Title>
              <Space align="center" wrap>
                <Tag color={(snapshot?.health.counts.total ?? 0) > 0 ? 'orange' : 'green'}>
                  {t('knowledge.healthIssueCount', { count: snapshot?.health.counts.total ?? 0 })}
                </Tag>
                <Button
                  size="small"
                  icon={<IconFile />}
                  loading={healthReviewLoading}
                  onClick={() => void handleWriteHealthReview()}
                >
                  {t('knowledge.writeHealthReview')}
                </Button>
              </Space>
            </Space>
            {renderHealthIssues()}
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(300px, 360px) minmax(0, 1fr)',
              gap: 16,
              width: '100%',
              alignItems: 'start',
            }}
          >
            <Card
              bodyStyle={{
                padding: 0,
                maxHeight: 'calc(100vh - 300px)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {!section && (
                <Tabs
                  activeKey={activeSection}
                  onChange={(key) => setActiveSection(key as KnowledgeSection)}
                  type="button"
                  style={{ padding: '12px 12px 0' }}
                >
                  <Tabs.TabPane tab={t('knowledge.indexEntries')} itemKey="entries" />
                  <Tabs.TabPane tab={t('knowledge.wiki')} itemKey="wiki" />
                  <Tabs.TabPane tab={t('knowledge.sources')} itemKey="sources" />
                  <Tabs.TabPane tab={t('knowledge.digestQueue')} itemKey="digest" />
                  <Tabs.TabPane tab={t('knowledge.recentUpdates')} itemKey="recent" />
                  <Tabs.TabPane tab={t('knowledge.relationships')} itemKey="relationships" />
                  <Tabs.TabPane tab={t('knowledge.health')} itemKey="health" />
                  <Tabs.TabPane tab={t('knowledge.index')} itemKey="index" />
                  <Tabs.TabPane tab={t('knowledge.log')} itemKey="log" />
                </Tabs>
              )}
              {results.length > 0 && (
                <div
                  style={{
                    borderTop: '1px solid var(--semi-color-border)',
                    padding: 12,
                    maxHeight: 180,
                    overflow: 'auto',
                  }}
                >
                  <Text strong>{t('knowledge.searchResults')}</Text>
                  <Space vertical align="start" style={{ width: '100%', marginTop: 8 }}>
                    {results.map((result) => (
                      <button
                        key={`${result.path}:${result.line}`}
                        type="button"
                        onClick={() => void openDocument(result.path)}
                        style={{
                          width: '100%',
                          border: '1px solid var(--semi-color-border)',
                          background: 'var(--semi-color-bg-0)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Space align="center">
                          {result.sourceType && (
                            <Tag size="small">
                              {result.sourceType === 'sources' ? t('knowledge.sources') : t('knowledge.wiki')}
                            </Tag>
                          )}
                          <Text strong size="small">
                            {result.line}
                          </Text>
                        </Space>
                        <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>
                          {result.path}
                        </Text>
                        <Text
                          type="tertiary"
                          size="small"
                          ellipsis={{ showTooltip: true }}
                          style={{ display: 'block', marginTop: 4 }}
                        >
                          {result.snippet}
                        </Text>
                      </button>
                    ))}
                  </Space>
                </div>
              )}
              <div style={{ padding: 12, overflow: 'auto' }}>{renderNavigator()}</div>
            </Card>
            {renderReader()}
          </div>
        )}
        <Modal
          title={t('knowledge.importTextSource')}
          visible={showImportText}
          onCancel={() => {
            if (!importLoading) setShowImportText(false);
          }}
          footer={
            <Space>
              <Button disabled={importLoading} onClick={() => setShowImportText(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="primary"
                theme="solid"
                loading={importLoading}
                disabled={!importBody.trim()}
                onClick={() => void handleImportTextSource()}
              >
                {t('knowledge.importTextConfirm')}
              </Button>
            </Space>
          }
        >
          <Space vertical align="start" style={{ width: '100%' }}>
            <Input
              value={importTitle}
              onChange={setImportTitle}
              placeholder={t('knowledge.importTextTitlePlaceholder')}
            />
            <TextArea
              value={importBody}
              onChange={setImportBody}
              autosize={{ minRows: 8, maxRows: 16 }}
              placeholder={t('knowledge.importTextBodyPlaceholder')}
            />
            <Text type="tertiary" size="small">
              {t('knowledge.importTextDesc')}
            </Text>
          </Space>
        </Modal>
        <Modal
          title={t('knowledge.importUrlSource')}
          visible={showImportUrl}
          onCancel={() => {
            if (!importLoading) setShowImportUrl(false);
          }}
          footer={
            <Space>
              <Button disabled={importLoading} onClick={() => setShowImportUrl(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="primary"
                theme="solid"
                loading={importLoading}
                disabled={!importUrl.trim()}
                onClick={() => void handleImportUrlSource()}
              >
                {t('knowledge.importUrlConfirm')}
              </Button>
            </Space>
          }
        >
          <Space vertical align="start" style={{ width: '100%' }}>
            <Input value={importUrl} onChange={setImportUrl} placeholder={t('knowledge.importUrlPlaceholder')} />
            <Input
              value={importUrlTitle}
              onChange={setImportUrlTitle}
              placeholder={t('knowledge.importUrlTitlePlaceholder')}
            />
            <TextArea
              value={importUrlNote}
              onChange={setImportUrlNote}
              autosize={{ minRows: 5, maxRows: 12 }}
              placeholder={t('knowledge.importUrlNotePlaceholder')}
            />
            <Text type="tertiary" size="small">
              {t('knowledge.importUrlDesc')}
            </Text>
          </Space>
        </Modal>
      </Space>
    </div>
  );
}

function isKnowledgeSupportedImportFile(file: File): boolean {
  return resolveKnowledgeImportFileKind({ name: file.name, type: file.type }).kind !== 'unsupported';
}

function getKnowledgeFolderRelativePath(file: File): string {
  const folderFile = file as File & { webkitRelativePath?: string };
  return folderFile.webkitRelativePath || file.name;
}
