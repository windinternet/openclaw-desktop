import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, Typography, Tag, Button, Spin, Empty, Space, Card, Input, Select, Toast, Modal, Switch } from '@douyinfe/semi-ui';
import {
  IconPlusCircle,
  IconRefresh,
  IconCalendar,
  IconSave,
  IconEdit,
} from '@douyinfe/semi-icons';
import { useStore } from '../lib';
import { useSettingsStore } from '../lib/settings-store';
import type { WorkspaceFile, WorkspaceFileContent } from '../lib/types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface ChannelInfo {
  id: string;
  enabled: boolean;
  connected: boolean;
  accounts?: { id: string; name: string; connected: boolean; lastSeen?: number }[];
}

function formatUptime(ms?: number): string {
  if (!ms) return '-';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

/* ── Memory Tab ───────────────────────────────────────────────── */

function getDateStrs(): { today: string; yesterday: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const today = `${y}-${m}-${d}`;
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterday = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
  return { today, yesterday };
}

function parseDateFromFilename(name: string): string | null {
  const m = name.match(/memory\/(\d{4}-\d{2}-\d{2})\.md$/);
  return m ? m[1] : null;
}

function formatDateLabel(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const [y, m, d] = dateStr.split('-');
  return t('tuning.dateFormat', { year: y, month: parseInt(m, 10), day: parseInt(d, 10) });
}

function MemoryTab() {
  const { t } = useTranslation();
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const workspaceFiles = useStore((s) => s.workspaceFiles);
  const fetchWorkspaceFiles = useStore((s) => s.fetchWorkspaceFiles);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;

  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (workspaceFiles.length === 0 && isConnected) {
      setLoading(true);
      fetchWorkspaceFiles().finally(() => setLoading(false));
    }
  }, [isConnected]);

  const memoryFiles = useMemo(() => {
    return workspaceFiles
      .filter((f) => /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(f.name))
      .sort((a, b) => b.name.localeCompare(a.name));
  }, [workspaceFiles]);

  const { today, yesterday } = useMemo(() => getDateStrs(), []);
  const todayFiles = useMemo(() => memoryFiles.filter((f) => parseDateFromFilename(f.name) === today), [memoryFiles, today]);
  const yesterdayFiles = useMemo(() => memoryFiles.filter((f) => parseDateFromFilename(f.name) === yesterday), [memoryFiles, yesterday]);
  const olderFiles = useMemo(() => memoryFiles.filter((f) => {
    const d = parseDateFromFilename(f.name);
    return d !== today && d !== yesterday;
  }), [memoryFiles, today, yesterday]);

  const handleRefresh = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    setContents({});
    setExpanded(new Set());
    await fetchWorkspaceFiles();
    setLoading(false);
  }, [isConnected, fetchWorkspaceFiles]);

  const handleToggleExpand = useCallback(async (file: WorkspaceFile) => {
    const fileName = file.name;
    if (expanded.has(fileName)) {
      setExpanded((prev) => { const next = new Set(prev); next.delete(fileName); return next; });
      return;
    }
    if (contents[fileName]) {
      setExpanded((prev) => new Set(prev).add(fileName));
      return;
    }
    if (!activeClient) return;
    setLoadingContent((prev) => new Set(prev).add(fileName));
    try {
      const data = await activeClient.request<WorkspaceFileContent>('agents.files.get', { agentId: 'main', name: fileName });
      if (data?.content) {
        setContents((prev) => ({ ...prev, [fileName]: data.content }));
        setExpanded((prev) => new Set(prev).add(fileName));
      }
    } catch { /* ignore */ }
    finally {
      setLoadingContent((prev) => { const next = new Set(prev); next.delete(fileName); return next; });
    }
  }, [activeClient, expanded, contents]);

  const renderMemoryEntry = (file: WorkspaceFile, isToday: boolean) => {
    const dateStr = parseDateFromFilename(file.name);
    const isExpanded = expanded.has(file.name);
    const isLoadingContent = loadingContent.has(file.name);
    const content = contents[file.name];
    return (
      <div key={file.name} onClick={() => handleToggleExpand(file)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleToggleExpand(file); }}
        style={{ marginBottom: 8, borderRadius: 8, border: isToday ? '1px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)', backgroundColor: 'var(--semi-color-bg-1)', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <Space><IconCalendar size="small" /><Text weight={600}>{dateStr ? formatDateLabel(dateStr, t) : file.name}</Text>{isToday && <Tag color="blue" size="small">{t('tuning.today')}</Tag>}</Space>
          <Space>
            {file.modifiedAt && <Text size="small" type="tertiary">{new Date(file.modifiedAt).toLocaleDateString()}</Text>}
            {file.size !== undefined && <Text size="small" type="tertiary">{file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`}</Text>}
            {!isExpanded && !isLoadingContent && <Text type="tertiary" size="small">{t('tuning.clickToView')}</Text>}
            {isLoadingContent && <Spin size="small" />}
          </Space>
        </div>
        {isExpanded && content && <div style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--semi-color-text-0)', padding: 16, backgroundColor: 'var(--semi-color-bg-0)', borderTop: '1px solid var(--semi-color-border)', fontFamily: 'monospace' }}>{content}</div>}
        {isExpanded && !content && !isLoadingContent && <div style={{ padding: 16, borderTop: '1px solid var(--semi-color-border)' }}><Text type="tertiary">{t('tuning.noContent')}</Text></div>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div><Text strong style={{ fontSize: 15 }}>{t('tuning.memoryOverview')}</Text><Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.memoryOverviewDesc')}</Text></div>
        <Button icon={<IconRefresh />} onClick={handleRefresh} loading={loading} theme="outline" size="small">{t('common.refresh')}</Button>
      </div>
      <div style={{ marginBottom: 20, padding: 16, borderRadius: 8, border: '1px solid var(--semi-color-border)', backgroundColor: 'var(--semi-color-bg-1)', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div><Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{t('tuning.connectionStatus')}</Text><Tag color={isConnected ? 'green' : 'red'}>{isConnected ? t('tuning.connected') : t('tuning.notConnected')}</Tag></div>
        <div><Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{t('tuning.memoryFiles')}</Text><Tag color={memoryFiles.length > 0 ? 'blue' : 'grey'}>{t('tuning.nFiles', { count: memoryFiles.length })}</Tag></div>
        <div><Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{t('tuning.todayMemory')}</Text><Tag color={todayFiles.length > 0 ? 'green' : 'grey'}>{todayFiles.length > 0 ? t('tuning.nEntries', { count: todayFiles.length }) : t('common.none')}</Tag></div>
      </div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin tip={t('tuning.loadingMemory')} /></div>}
      {!isConnected && !loading && <Empty description={t('tuning.notConnectedMemory')} style={{ marginTop: 48 }} />}
      {isConnected && !loading && memoryFiles.length === 0 && <Empty description={t('tuning.noMemory')} style={{ marginTop: 48 }} />}
      {todayFiles.length > 0 && <div style={{ marginBottom: 24 }}><Text strong style={{ display: 'block', marginBottom: 12 }}>{t('tuning.todayMemory')} <Tag size="small" color="blue">{today}</Tag></Text>{todayFiles.map((f) => renderMemoryEntry(f, true))}</div>}
      {yesterdayFiles.length > 0 && <div style={{ marginBottom: 24 }}><Text strong style={{ display: 'block', marginBottom: 12 }}>{t('tuning.yesterdayMemory')} <Tag size="small">{yesterday}</Tag></Text>{yesterdayFiles.map((f) => renderMemoryEntry(f, false))}</div>}
      {olderFiles.length > 0 && <div style={{ marginBottom: 24 }}><Text strong style={{ display: 'block', marginBottom: 12 }}>{t('tuning.olderMemory')} <Tag size="small">{t('tuning.nEntries', { count: olderFiles.length })}</Tag></Text>{olderFiles.map((f) => renderMemoryEntry(f, false))}</div>}
    </div>
  );
}

/* ── Context Profile Presets ──────────────────────────────────── */

interface ContextPreset {
  id: string;
  emoji: string;
  name: string;
  description: string;
  perFileChars: number;
  totalChars: number;
  followUp: string;
}

const CONTEXT_PRESETS: ContextPreset[] = [
  { id: 'personal-assistant', emoji: '✨', name: 'Personal Assistant', description: 'Balanced default for daily use.', perFileChars: 20000, totalChars: 150000, followUp: 'every-turn' },
  { id: 'code-agent', emoji: '🛠️', name: 'Code Agent', description: 'Highest context budget for repo work.', perFileChars: 50000, totalChars: 300000, followUp: 'every-turn' },
  { id: 'team-bot', emoji: '👥', name: 'Team Bot', description: 'Lean follow-ups for shared bots.', perFileChars: 10000, totalChars: 80000, followUp: 'skip-safe' },
  { id: 'minimal', emoji: '⚡', name: 'Minimal', description: 'Smallest context budget and lowest cost.', perFileChars: 5000, totalChars: 30000, followUp: 'skip-safe' },
];

/* ── Persona Tab ──────────────────────────────────────────────── */

function PersonaTab() {
  const { t } = useTranslation();
  const currentInstance = useStore((s) => s.instances.find((i) => i.id === s.currentInstanceId) ?? null);
  const agentIdentity = useStore((s) => s.agentIdentity);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const gatewayUser = currentInstance?.gatewayUser;
  const isConnected = connectionStatus === 'connected' && activeClient !== null;
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const assistantName = currentInstance?.assistantName || agentIdentity?.name || currentInstance?.name || 'AI';
  const displayName = gatewayUser?.whatToCall || currentInstance?.name || 'Operator';

  /* identity editing */
  const [editingAssistant, setEditingAssistant] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState('');
  const [savingAssistant, setSavingAssistant] = useState(false);
  const [editingUser, setEditingUser] = useState(false);
  const [userDraft, setUserDraft] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  const saveAssistant = useCallback(async () => {
    if (!activeClient || !assistantDraft.trim()) return;
    setSavingAssistant(true);
    try {
      await activeClient.request('agent.identity.set', { agentId: agentIdentity?.agentId || 'main', name: assistantDraft.trim() });
      await useStore.getState().fetchAgentIdentity();
      Toast.success(t('tuning.aiNameUpdated'));
      setEditingAssistant(false);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.saveFailed'));
    } finally {
      setSavingAssistant(false);
    }
  }, [activeClient, agentIdentity?.agentId, assistantDraft, t]);

  const saveUser = useCallback(async () => {
    if (!activeClient || !userDraft.trim()) return;
    setSavingUser(true);
    try {
      await activeClient.request('gateway.user.set', { whatToCall: userDraft.trim() });
      await useStore.getState().fetchGatewayUserForCurrent();
      updateSettings({ userDisplayName: userDraft.trim() });
      Toast.success(t('tuning.nameUpdated'));
      setEditingUser(false);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.saveFailed'));
    } finally {
      setSavingUser(false);
    }
  }, [activeClient, userDraft, updateSettings, t]);

  /* config editing */
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null);
  const [perFileChars, setPerFileChars] = useState<number | null>(null);
  const [totalChars, setTotalChars] = useState<number | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [draftPerFile, setDraftPerFile] = useState('');
  const [draftTotal, setDraftTotal] = useState('');
  const [draftFollowUp, setDraftFollowUp] = useState('every-turn');

  const loadConfig = useCallback(async () => {
    if (!activeClient || !isConnected) return;
    setLoading(true);
    try {
      const config = await activeClient.request<Record<string, unknown>>('config.get');
      const parsed = config?.parsed as Record<string, unknown> | undefined;
      const agents = parsed?.agents as Record<string, unknown> | undefined;
      const bootstrap = agents?.defaults as Record<string, unknown> | undefined;
      const pf = typeof bootstrap?.bootstrapMaxFileChars === 'number'
        ? bootstrap.bootstrapMaxFileChars
        : typeof bootstrap?.maxFileChars === 'number' ? bootstrap.maxFileChars : null;
      const tot = typeof bootstrap?.bootstrapMaxTotalChars === 'number'
        ? bootstrap.bootstrapMaxTotalChars
        : typeof bootstrap?.maxTotalChars === 'number' ? bootstrap.maxTotalChars : null;
      const fu = typeof bootstrap?.bootstrapFollowUp === 'string'
        ? bootstrap.bootstrapFollowUp
        : typeof bootstrap?.followUp === 'string' ? bootstrap.followUp : null;

      setPerFileChars(pf);
      setTotalChars(tot);
      setFollowUp(fu);
      setDraftPerFile(pf != null ? String(pf) : '');
      setDraftTotal(tot != null ? String(tot) : '');
      setDraftFollowUp(fu || 'every-turn');

      if (pf != null && tot != null && fu) {
        const match = CONTEXT_PRESETS.find((p) => p.perFileChars === pf && p.totalChars === tot && p.followUp === fu);
        setCurrentPresetId(match ? match.id : null);
      } else {
        setCurrentPresetId(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [activeClient, isConnected]);

  useEffect(() => {
    if (isConnected) queueMicrotask(() => { void loadConfig(); });
  }, [isConnected, loadConfig]);

  const applyPreset = useCallback(async (preset: ContextPreset) => {
    if (!activeClient || !isConnected) return;
    setApplying(preset.id);
    try {
      await activeClient.request('config.patch', { raw: { agents: { defaults: { bootstrapMaxFileChars: preset.perFileChars, bootstrapMaxTotalChars: preset.totalChars, bootstrapFollowUp: preset.followUp } } } });
      setCurrentPresetId(preset.id);
      setPerFileChars(preset.perFileChars); setTotalChars(preset.totalChars); setFollowUp(preset.followUp);
      setDraftPerFile(String(preset.perFileChars)); setDraftTotal(String(preset.totalChars)); setDraftFollowUp(preset.followUp);
      Toast.success(t('tuning.presetApplied', { name: preset.name }));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.presetApplyFailed'));
    } finally { setApplying(null); }
  }, [activeClient, isConnected, t]);

  const saveCustomValues = useCallback(async () => {
    if (!activeClient || !isConnected) return;
    const pf = parseInt(draftPerFile, 10); const tot = parseInt(draftTotal, 10);
    if (!pf || !tot || pf < 1000 || tot < 1000) { Toast.warning(t('tuning.invalidValue')); return; }
    setSaving(true);
    try {
      await activeClient.request('config.patch', { raw: { agents: { defaults: { bootstrapMaxFileChars: pf, bootstrapMaxTotalChars: tot, bootstrapFollowUp: draftFollowUp } } } });
      setPerFileChars(pf); setTotalChars(tot); setFollowUp(draftFollowUp);
      const match = CONTEXT_PRESETS.find((p) => p.perFileChars === pf && p.totalChars === tot && p.followUp === draftFollowUp);
      setCurrentPresetId(match ? match.id : null);
      Toast.success(t('tuning.saved'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.saveFailed'));
    } finally { setSaving(false); }
  }, [activeClient, isConnected, draftPerFile, draftTotal, draftFollowUp, t]);

  const dirty = perFileChars != null && (String(perFileChars) !== draftPerFile || String(totalChars) !== draftTotal || (followUp || 'every-turn') !== draftFollowUp);
  const currentPreset = currentPresetId ? CONTEXT_PRESETS.find((p) => p.id === currentPresetId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 15 }}>{t('tuning.contextProfile')}</Text>
        {!isConnected && <Tag color="orange">{t('tuning.notConnectedGateway')}</Tag>}
      </div>

      {/* Identity */}
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>{t('tuning.identity')}</Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
            <div><Text weight={600}>{t('tuning.aiName')}</Text><Text type="tertiary" size="small">{agentIdentity?.agentId ? `Agent: ${agentIdentity.agentId}` : ''}</Text></div>
            {editingAssistant ? (
              <Space><Input size="small" value={assistantDraft} onChange={setAssistantDraft} style={{ width: 180 }} placeholder={t('tuning.aiNamePlaceholder')} /><Button size="small" onClick={saveAssistant} loading={savingAssistant} theme="solid">{t('common.save')}</Button><Button size="small" onClick={() => setEditingAssistant(false)} theme="outline">{t('common.cancel')}</Button></Space>
            ) : (
              <Space><Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 500 }}>{assistantName}</Text><Button icon={<IconEdit />} size="small" onClick={() => { setAssistantDraft(assistantName); setEditingAssistant(true); }} theme="borderless" /></Space>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
            <div><Text weight={600}>{t('tuning.userName')}</Text><Text type="tertiary" size="small">{t('tuning.userNameDesc')}</Text></div>
            {editingUser ? (
              <Space><Input size="small" value={userDraft} onChange={setUserDraft} style={{ width: 180 }} placeholder={t('tuning.userNamePlaceholder')} /><Button size="small" onClick={saveUser} loading={savingUser} theme="solid">{t('common.save')}</Button><Button size="small" onClick={() => setEditingUser(false)} theme="outline">{t('common.cancel')}</Button></Space>
            ) : (
              <Space><Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 500 }}>{displayName}</Text><Button icon={<IconEdit />} size="small" onClick={() => { setUserDraft(displayName); setEditingUser(true); }} theme="borderless" /></Space>
            )}
          </div>
        </div>
      </Card>

      {isConnected && loading && <Spin tip={t('common.loading')} />}

      {isConnected && !loading && (
        <>
          {/* Custom values */}
          <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text strong>{t('tuning.contextBudget')} <Tag size="small" color="blue">{t('tuning.editable')}</Tag></Text>
              <Space>
                {currentPreset && <Tag color="green" size="small">{t('tuning.presetMatch', { name: currentPreset.name })}</Tag>}
                <Button icon={<IconSave />} size="small" theme="borderless" onClick={saveCustomValues} loading={saving} disabled={!dirty}>{t('common.save')}</Button>
              </Space>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>{t('tuning.bootstrapPerFile')}</Text>
                <Input value={draftPerFile} onChange={setDraftPerFile} size="small" placeholder="12000" />
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.bootstrapPerFileDesc')}</Text>
              </div>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>{t('tuning.bootstrapTotal')}</Text>
                <Input value={draftTotal} onChange={setDraftTotal} size="small" placeholder="60000" />
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.bootstrapTotalDesc')}</Text>
              </div>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>{t('tuning.followUpTurns')}</Text>
                <Select value={draftFollowUp} onChange={(v) => setDraftFollowUp(v as string)} size="small" style={{ width: '100%' }}>
                  <Select.Option value="every-turn">{t('tuning.everyTurn')}</Select.Option>
                  <Select.Option value="skip-safe">{t('tuning.skipSafeFollowUps')}</Select.Option>
                </Select>
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.followUpTurnsDesc')}</Text>
              </div>
            </div>
          </Card>

          {/* Presets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {CONTEXT_PRESETS.map((preset) => {
              const active = currentPresetId === preset.id;
              const isApplying = applying === preset.id;
              return (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset)} disabled={active || isApplying}
                  style={{ textAlign: 'left', border: `1.5px solid ${active ? 'var(--semi-color-success)' : 'var(--semi-color-border)'}`, background: active ? 'var(--semi-color-success-light-default)' : 'var(--semi-color-bg-1)', borderRadius: 10, padding: 16, cursor: active ? 'default' : 'pointer', opacity: isApplying ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>{preset.emoji}</span>
                    <div>
                      <Text strong>{preset.name}</Text>
                      <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 2 }}>{preset.description}</Text>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                    <span>{preset.perFileChars.toLocaleString()}{t('tuning.perFileUnit')}</span>
                    <span>{preset.totalChars.toLocaleString()}{t('tuning.totalCharsUnit')}</span>
                    <span>{preset.followUp === 'every-turn' ? t('tuning.everyTurnShort') : t('tuning.skipTurn')}</span>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {active ? <Tag color="green" size="small">{t('tuning.current')}</Tag> : <Tag color="blue" size="small" style={{ opacity: 0 }}>&nbsp;</Tag>}
                    {isApplying && <Spin size="small" />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Channels Tab ──────────────────────────────────────────────── */

const DM_SCOPE_OPTIONS = [
  { value: 'main', label: '所有 DM 共享会话' },
  { value: 'per-peer', label: '按发送者隔离' },
  { value: 'per-channel-peer', label: '按渠道+发送者隔离 (推荐)' },
  { value: 'per-account-channel-peer', label: '按账户+渠道+发送者隔离' },
];

const DM_POLICY_OPTIONS = [
  { value: 'pairing', label: '配对模式 (推荐)' },
  { value: 'open', label: '开放模式' },
];

function ChannelsTab() {
  const { t } = useTranslation();
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Config values
  const [dmScope, setDmScope] = useState<string | null>(null);
  const [dmPolicy, setDmPolicy] = useState<string | null>(null);
  const [resetTime, setResetTime] = useState<string | null>(null);

  // Local drafts
  const [draftDmScope, setDraftDmScope] = useState('per-channel-peer');
  const [draftDmPolicy, setDraftDmPolicy] = useState('pairing');
  const [draftResetTime, setDraftResetTime] = useState('04:00');

  const loadChannelConfig = useCallback(async () => {
    if (!activeClient || !isConnected) return;
    setLoading(true);
    try {
      const config = await activeClient.request<Record<string, unknown>>('config.get');
      const parsedCfg = config?.parsed as Record<string, unknown> | undefined;
      const sessionCfg = parsedCfg?.session as Record<string, unknown> | undefined;
      const s = typeof sessionCfg?.dmScope === 'string' ? sessionCfg.dmScope : null;
      const p = typeof sessionCfg?.dmPolicy === 'string' ? sessionCfg.dmPolicy : null;
      const rt = typeof sessionCfg?.resetTime === 'string' ? sessionCfg.resetTime : null;
      setDmScope(s);
      setDmPolicy(p);
      setResetTime(rt);
      if (s) setDraftDmScope(s);
      if (p) setDraftDmPolicy(p);
      if (rt) setDraftResetTime(rt);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [activeClient, isConnected]);

  useEffect(() => {
    if (isConnected) queueMicrotask(() => { void loadChannelConfig(); });
  }, [isConnected, loadChannelConfig]);

  const saveChannelConfig = useCallback(async (key: string, value: string) => {
    if (!activeClient || !isConnected) return;
    setSaving(key);
    try {
      await activeClient.request('config.patch', { raw: { session: { [key]: value } } });
      if (key === 'dmScope') setDmScope(value);
      else if (key === 'dmPolicy') setDmPolicy(value);
      else if (key === 'resetTime') setResetTime(value);
      Toast.success(t('tuning.saved'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.saveFailed'));
    } finally { setSaving(null); }
  }, [activeClient, isConnected, t]);

  const dirtyDmScope = dmScope !== draftDmScope;
  const dirtyDmPolicy = dmPolicy !== draftDmPolicy;
  const dirtyResetTime = resetTime !== draftResetTime;

  const channels = useMemo<ChannelInfo[]>(() => [
    { id: 'whatsapp', enabled: true, connected: false, accounts: [{ id: 'default', name: 'Default', connected: false }] },
    { id: 'telegram', enabled: true, connected: false, accounts: [{ id: 'default', name: 'Default', connected: false }] },
    { id: 'wechat', enabled: false, connected: false },
    { id: 'qq', enabled: false, connected: false },
    { id: 'discord', enabled: false, connected: false },
    { id: 'slack', enabled: false, connected: false },
    { id: 'signal', enabled: false, connected: false },
    { id: 'imessage', enabled: false, connected: false },
    { id: 'feishu', enabled: true, connected: true, accounts: [{ id: 'default', name: '飞书', connected: true, lastSeen: Date.now() - 30000 }] },
    { id: 'matrix', enabled: false, connected: false },
    { id: 'webchat', enabled: true, connected: true, accounts: [{ id: 'default', name: 'WebChat', connected: true }] },
    { id: 'line', enabled: false, connected: false },
  ], []);
  // Sort: connected > enabled > not enabled
  const sortedChannels = useMemo(() => [...channels].sort((a, b) => {
    const aWeight = a.connected ? 0 : a.enabled ? 1 : 2;
    const bWeight = b.connected ? 0 : b.enabled ? 1 : 2;
    return aWeight - bWeight;
  }), [channels]);

  const channelStatusColors: Record<string, string> = {
    whatsapp: '#25D366', telegram: '#26A5E4', wechat: '#07C160', qq: '#12B7F5',
    discord: '#5865F2', slack: '#4A154B', signal: '#3B45FD',
    imessage: '#34C759', feishu: '#3370FF', matrix: '#2D2D2D', webchat: '#6366F1', line: '#06C755',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><Text strong style={{ fontSize: 15 }}>{t('tuning.channelsTitle')}</Text><Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.channelsDesc')}</Text></div>
        <Space>
          {loading && <Spin size="small" />}
          {!isConnected && <Tag color="orange">{t('tuning.notConnectedGateway')}</Tag>}
        </Space>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {sortedChannels.map((ch) => {
          const connected = ch.connected || (ch.accounts?.some((a) => a.connected) ?? false);
          const color = channelStatusColors[ch.id] || 'var(--semi-color-text-2)';
          return (
            <div key={ch.id} style={{
              padding: 16, borderRadius: 8,
              border: `1px solid ${connected ? color : 'var(--semi-color-border)'}`,
              backgroundColor: 'var(--semi-color-bg-1)', borderLeft: `4px solid ${ch.enabled ? color : 'var(--semi-color-border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ textTransform: 'capitalize' }}>{ch.id}</Text>
                <Tag color={connected ? 'green' : ch.enabled ? 'blue' : 'grey'} size="small">{connected ? t('tuning.connected') : ch.enabled ? t('tuning.enabled') : t('tuning.notEnabled')}</Tag>
              </div>
              {ch.accounts?.map((acc) => (
                <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text size="small" type="tertiary">{acc.name}</Text>
                  <Tag color={acc.connected ? 'green' : 'grey'} size="small">{acc.connected ? t('tuning.online') : t('tuning.offline')}</Tag>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>{t('tuning.messageStrategy')} <Tag size="small" color="blue">{t('tuning.editable')}</Tag></Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>{t('tuning.dmScope')}</Text>
              <Button size="small" theme="borderless" icon={<IconSave />}
                onClick={() => saveChannelConfig('dmScope', draftDmScope)}
                loading={saving === 'dmScope'} disabled={!dirtyDmScope || !isConnected}>
                {t('common.save')}
              </Button>
            </div>
            <Select value={draftDmScope} onChange={(v) => setDraftDmScope(v as string)} style={{ width: 280 }} size="small">
              {DM_SCOPE_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
              {dmScope !== null ? t('tuning.currentValue', { value: DM_SCOPE_OPTIONS.find(o => o.value === dmScope)?.label || dmScope }) : t('tuning.notSetDefault')}
            </Text>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>{t('tuning.dmPolicy')}</Text>
              <Button size="small" theme="borderless" icon={<IconSave />}
                onClick={() => saveChannelConfig('dmPolicy', draftDmPolicy)}
                loading={saving === 'dmPolicy'} disabled={!dirtyDmPolicy || !isConnected}>
                {t('common.save')}
              </Button>
            </div>
            <Select value={draftDmPolicy} onChange={(v) => setDraftDmPolicy(v as string)} style={{ width: 240 }} size="small">
              {DM_POLICY_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
              {dmPolicy !== null ? t('tuning.currentValue', { value: DM_POLICY_OPTIONS.find(o => o.value === dmPolicy)?.label || dmPolicy }) : t('tuning.defaultPairing')}
            </Text>
          </div>
        </div>
      </Card>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>{t('tuning.sessionSettings')} <Tag size="small" color="blue">{t('tuning.editable')}</Tag></Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>{t('tuning.resetTime')}</Text>
              <Button size="small" theme="borderless" icon={<IconSave />}
                onClick={() => saveChannelConfig('resetTime', draftResetTime)}
                loading={saving === 'resetTime'} disabled={!dirtyResetTime || !isConnected}>
                {t('common.save')}
              </Button>
            </div>
            <Select value={draftResetTime} onChange={(v) => setDraftResetTime(v as string)} style={{ width: 180 }} size="small">
              <Select.Option value="00:00">00:00</Select.Option>
              <Select.Option value="04:00">{t('tuning.defaultTime0400')}</Select.Option>
              <Select.Option value="06:00">06:00</Select.Option>
              <Select.Option value="08:00">08:00</Select.Option>
            </Select>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
              {resetTime !== null ? t('tuning.currentTime', { value: resetTime }) : t('tuning.default0400')}
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Models Tab ────────────────────────────────────────────────── */

function ModelsTab() {
  const { t } = useTranslation();
  const models = useStore((s) => s.models);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;
  const fetchModels = useStore((s) => s.fetchModels);
  const [loading, setLoading] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  // Add model modal
  const [modalVisible, setModalVisible] = useState(false);
  const [addingModel, setAddingModel] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [apiType, setApiType] = useState('openai-completions');
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasReasoning, setHasReasoning] = useState(false);
  const [hasVision, setHasVision] = useState(false);

  // Default model
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [draftDefaultModel, setDraftDefaultModel] = useState<string | null>(null);
  const [defaultModelLoaded, setDefaultModelLoaded] = useState(false);

  // Load configured models and default model
  useEffect(() => {
    if (!isConnected) return;
    setLoading(true);
    void (async () => {
      await fetchModels();
      try {
        const config = await activeClient!.request<Record<string, unknown>>('config.get');
        const parsedDef = config?.parsed as Record<string, unknown> | undefined;
        const agentsDef = parsedDef?.agents as Record<string, unknown> | undefined;
        const defaults = agentsDef?.defaults as Record<string, unknown> | undefined;
        const modelCfg = defaults?.model as Record<string, unknown> | string | undefined;
        if (typeof modelCfg === 'string') {
          setDefaultModel(modelCfg);
          setDraftDefaultModel(modelCfg);
        } else if (modelCfg && typeof modelCfg === 'object') {
          const primary = (modelCfg as Record<string, unknown>).primary as string | undefined;
          if (primary) {
            setDefaultModel(primary);
            setDraftDefaultModel(primary);
          }
        }
      } catch { /* ignore */ }
      finally { setDefaultModelLoaded(true); setLoading(false); }
    })();
  }, [isConnected, fetchModels, activeClient]);

  const handleRefresh = useCallback(async () => {
    setLoading(true); await fetchModels(); setLoading(false);
  }, [fetchModels]);

  const handleSaveDefaultModel = useCallback(async () => {
    if (!activeClient || !draftDefaultModel || !isConnected) return;
    setSavingModel(true);
    try {
      await activeClient.request('config.patch', {
        raw: { agents: { defaults: { model: { primary: draftDefaultModel } } } },
      });
      setDefaultModel(draftDefaultModel);
      Toast.success(t('tuning.modelUpdated'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.saveFailed'));
    } finally { setSavingModel(false); }
  }, [activeClient, draftDefaultModel, isConnected, t]);

  const handleAddModel = useCallback(async () => {
    if (!activeClient || !isConnected) return;
    if (!providerId.trim() || !modelId.trim()) {
      Toast.warning(t('tuning.fillProviderAndModel'));
      return;
    }
    const provId = providerId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setAddingModel(true);
    try {
      const modelsArr: Record<string, unknown>[] = [{
        id: modelId.trim(),
        name: modelName.trim() || modelId.trim(),
      }];
      if (hasReasoning) modelsArr[0].reasoning = true;
      modelsArr[0].input = hasVision ? ['text', 'image'] : ['text'];

      const patch: Record<string, unknown> = {
        raw: {
          models: {
            providers: {
              [provId]: {
                baseUrl: providerBaseUrl.trim() || `https://api.${provId}.com`,
                api: apiType,
                models: modelsArr,
              },
            },
          },
          auth: {
            profiles: {
              [`${provId}:default`]: {
                provider: provId,
                mode: apiKey ? 'api_key' : 'none',
              } as Record<string, unknown>,
            },
          },
          plugins: {
            entries: {
              [provId]: { enabled: true },
            },
          },
        },
      };
      // Include apiKey if provided
      if (apiKey.trim()) {
        const raw = patch.raw as Record<string, unknown>;
      const authProfiles = (raw.auth as Record<string, unknown>).profiles as Record<string, Record<string, unknown>>;
      authProfiles[`${provId}:default`].apiKey = apiKey.trim();
      }
      await activeClient.request('config.patch', patch);
      Toast.success(t('tuning.modelAdded', { name: provId }));
      setModalVisible(false);
      setProviderId(''); setProviderBaseUrl(''); setApiType('openai-completions');
      setModelId(''); setModelName(''); setApiKey(''); setHasReasoning(false); setHasVision(false);
      await fetchModels();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.addFailed'));
    } finally { setAddingModel(false); }
  }, [activeClient, isConnected, providerId, providerBaseUrl, apiType, modelId, modelName, apiKey, hasReasoning, hasVision, fetchModels, t]);

  const modelsNeedSave = defaultModel !== null && draftDefaultModel !== null && defaultModel !== draftDefaultModel;
  const providerList = useMemo(() => {
    const seen = new Set<string>();
    return models.filter(m => {
      if (!m.provider || seen.has(m.provider)) return false;
      seen.add(m.provider);
      return true;
    });
  }, [models]);

  const apiTypeOptions = [
    { value: 'openai-completions', label: 'OpenAI Compatible' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'google-gemini', label: 'Google Gemini' },
    { value: 'ollama', label: 'Ollama' },
    { value: 'openai', label: 'OpenAI Chat' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Text strong style={{ fontSize: 15 }}>{t('tuning.modelsTitle')}</Text>
          <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.modelsTitleDesc')}</Text>
        </div>
        <Space>
          {!isConnected && <Tag color="orange">{t('tuning.notConnected')}</Tag>}
          <Button icon={<IconPlusCircle />} onClick={() => setModalVisible(true)} theme="solid" size="small" disabled={!isConnected}>{t('tuning.addModel')}</Button>
          <Button icon={<IconRefresh />} onClick={handleRefresh} loading={loading} theme="outline" size="small">{t('common.refresh')}</Button>
        </Space>
      </div>
      {!isConnected && !loading && defaultModelLoaded && <Empty description={t('tuning.notConnectedGateway')} style={{ marginTop: 48 }} />}
      {loading && !defaultModelLoaded && <Spin tip={t('tuning.loadingModels')} />}
      {defaultModelLoaded && (
        <>
          <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('tuning.connectedModels')} <Tag color="green" size="small">{models.length}</Tag></Text>
            {models.length === 0 && !loading && <Empty description={t('tuning.noModelsDesc')} style={{ padding: 20 }} />}
            {models.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {models.map((m) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 6,
                    border: '1px solid var(--semi-color-border)', backgroundColor: 'var(--semi-color-fill-0)'
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.id}</Text>
                      {(m.name || m.alias) && (
                        <Text type="tertiary" size="small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.alias || m.name}
                        </Text>
                      )}
                    </div>
                    <Space>
                      {m.provider && <Tag color="grey" size="small">{m.provider}</Tag>}
                      {m.vision && <Tag color="violet" size="small">{t('tuning.visual')}</Tag>}
                      {m.thinking && <Tag color="blue" size="small">{t('tuning.reasoning')}</Tag>}
                      <Tag color="green" size="small">{t('tuning.connected')}</Tag>
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong>{t('tuning.defaultModel')} <Tag size="small" color="blue">{t('tuning.editable')}</Tag></Text>
              <Button size="small" theme="borderless" icon={<IconSave />}
                onClick={handleSaveDefaultModel}
                loading={savingModel} disabled={!modelsNeedSave || !isConnected}>
                {t('common.save')}
              </Button>
            </div>
            <Select
              value={draftDefaultModel ?? undefined}
              onChange={(v) => setDraftDefaultModel(v as string)}
              style={{ width: 320 }}
              size="small"
              filter
              emptyContent={<Text type="tertiary" size="small">{t('tuning.noMatchModel')}</Text>}
            >
              {models.map((m) => (
                <Select.Option key={m.id} value={m.id}>
                  {m.alias || m.name || m.id}
                  <Text type="tertiary" size="small" style={{ marginLeft: 8 }}>{m.provider && `(${m.provider})`}</Text>
                </Select.Option>
              ))}
            </Select>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
              {defaultModel ? t('tuning.currentModel', { value: defaultModel }) : t('tuning.noDefaultModel')}
            </Text>
          </Card>
          {/* Provider overview */}
          <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('tuning.providerDistribution')} <Tag size="small">{providerList.length}</Tag></Text>
            {providerList.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {providerList.map((m) => (
                  <Tag key={m.provider} color="blue" size="small">{m.provider} ({models.filter(x => x.provider === m.provider).length})</Tag>
                ))}
              </div>
            ) : (
              <Text type="tertiary" size="small">{t('tuning.noProviderDetected')}</Text>
            )}
          </Card>
        </>
      )}

      {/* ── Add Model Modal ── */}
      <Modal
        title={t('tuning.addModelTitle')}
        visible={modalVisible}
        onCancel={() => { setModalVisible(false); }}
        footer={
          <Space>
            <Button onClick={() => setModalVisible(false)} theme="light">{t('common.cancel')}</Button>
            <Button onClick={handleAddModel} theme="solid" loading={addingModel} disabled={!providerId.trim() || !modelId.trim()}>
              {t('tuning.add')}
            </Button>
          </Space>
        }
        style={{ width: 520 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 6, color: 'var(--semi-color-text-1)' }}>
              {t('tuning.providerId')} <Tag size="small" color="red">{t('tuning.providerIdRequired')}</Tag>
            </Text>
            <Input value={providerId} onChange={setProviderId} placeholder="my-local" size="small" />
            <Text type="tertiary" size="small" style={{ marginTop: 2 }}>{t('tuning.providerIdDesc')}</Text>
          </div>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 6, color: 'var(--semi-color-text-1)' }}>{t('tuning.baseUrl')}</Text>
            <Input value={providerBaseUrl} onChange={setProviderBaseUrl} placeholder="https://api.openai.com" size="small" />
            <Text type="tertiary" size="small" style={{ marginTop: 2 }}>{t('tuning.baseUrlDesc')}</Text>
          </div>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 6, color: 'var(--semi-color-text-1)' }}>{t('tuning.apiType')}</Text>
            <Select value={apiType} onChange={(v) => setApiType(v as string)} style={{ width: '100%' }} size="small">
              {apiTypeOptions.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
              ))}
            </Select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Text size="small" style={{ display: 'block', marginBottom: 6, color: 'var(--semi-color-text-1)' }}>
                {t('tuning.modelId')} <Tag size="small" color="red">{t('tuning.modelIdRequired')}</Tag>
              </Text>
              <Input value={modelId} onChange={setModelId} placeholder="gpt-4o" size="small" />
            </div>
            <div>
              <Text size="small" style={{ display: 'block', marginBottom: 6, color: 'var(--semi-color-text-1)' }}>{t('tuning.displayName')}</Text>
              <Input value={modelName} onChange={setModelName} placeholder="GPT-4o" size="small" />
            </div>
          </div>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 6, color: 'var(--semi-color-text-1)' }}>{t('tuning.apiKey')}</Text>
            <Input value={apiKey} onChange={setApiKey} placeholder="sk-..." mode="password" size="small" />
            <Text type="tertiary" size="small" style={{ marginTop: 2 }}>{t('tuning.apiKeyDesc')}</Text>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Switch checked={hasReasoning} onChange={setHasReasoning} />
            <Text size="small">{t('tuning.supportReasoning')}</Text>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Switch checked={hasVision} onChange={setHasVision} />
            <Text size="small">{t('tuning.supportVision')}</Text>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── General Tab ───────────────────────────────────────────────── */

function GeneralTab() {
  const { t } = useTranslation();
  const currentInstance = useStore((s) => s.instances.find((i) => i.id === s.currentInstanceId) ?? null);
  const health = useStore((s) => s.health);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bindMode, setBindMode] = useState<string | null>(null);
  const [draftBindMode, setDraftBindMode] = useState('loopback');

  useEffect(() => {
    if (!isConnected || bindMode !== null) return;
    setLoading(true);
    void (async () => {
      try {
        const config = await activeClient!.request<Record<string, unknown>>('config.get');
        const gwConfig = (config?.parsed as Record<string, unknown> | undefined)?.gateway as Record<string, unknown> | undefined;
        const bind = typeof gwConfig?.bind === 'string' ? gwConfig.bind : null;
        if (bind) { setBindMode(bind); setDraftBindMode(bind); }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [isConnected, activeClient, bindMode]);

  const handleSaveBindMode = useCallback(async () => {
    if (!activeClient || !isConnected) return;
    setSaving(true);
    try {
      await activeClient.request('config.patch', { raw: { gateway: { bind: draftBindMode } } });
      setBindMode(draftBindMode);
      Toast.success(t('tuning.bindModeUpdated'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('tuning.saveFailed'));
    } finally { setSaving(false); }
  }, [activeClient, draftBindMode, isConnected, t]);

  const dirty = bindMode !== null && bindMode !== draftBindMode;

  const connectionStatusLabel = connectionStatus === 'connected'
    ? t('tuning.connected')
    : connectionStatus === 'connecting'
      ? t('instance.statusConnecting')
      : connectionStatus === 'error'
        ? t('instance.statusError')
        : t('tuning.notConnected');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div><Text strong style={{ fontSize: 15 }}>{t('tuning.generalTitle')}</Text><Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.generalTitleDesc')}</Text></div>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>{t('tuning.currentConnection')}</Text>
        <div style={{ display: 'grid', gap: 8 }}>
          {([
            [t('tuning.gatewayAddress'), currentInstance?.gatewayUrl || '—', 'monospace'],
            [t('tuning.connectionStatus'), connectionStatusLabel, null],
            [t('tuning.instanceName'), currentInstance?.name || '—', 'monospace'],
            [t('tuning.authMode'), 'Token', null],
            [t('tuning.gatewayVersion'), health?.version || '—', 'monospace'],
            [t('tuning.uptime'), formatUptime(health?.uptime), 'monospace'],
          ] as const).map(([label, value, font]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
              <Text type="tertiary" size="small">{label}</Text>
              <Text style={{ fontFamily: font || undefined, fontSize: 13 }}>{value}</Text>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text strong>{t('tuning.network')} <Tag size="small" color="blue">{t('tuning.editable')}</Tag></Text>
          <Space>
            {loading && <Spin size="small" />}
            <Button size="small" theme="borderless" icon={<IconSave />}
              onClick={handleSaveBindMode}
              loading={saving} disabled={!dirty || !isConnected}>
              {t('common.save')}
            </Button>
          </Space>
        </div>
        <div>
          <Select value={draftBindMode} onChange={(v) => setDraftBindMode(v as string)} style={{ width: 240 }} size="small">
            <Select.Option value="loopback">{t('tuning.bindLoopback')}</Select.Option>
            <Select.Option value="lan">{t('tuning.bindLan')}</Select.Option>
            <Select.Option value="tailnet">{t('tuning.bindTailscale')}</Select.Option>
          </Select>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 6, backgroundColor: 'var(--semi-color-warning-light-default)', border: '1px solid var(--semi-color-warning)' }}>
            <Text size="small" style={{ color: 'var(--semi-color-warning)' }}>{t('tuning.bindRestartWarning')}</Text>
          </div>
          <div style={{ marginTop: 16 }}>
            <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>{t('tuning.controlPort')}</Text>
            <Input defaultValue="18789" style={{ width: 140 }} size="small" disabled />
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{t('tuning.portFixed')}</Text>
          </div>
        </div>
      </Card>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>{t('tuning.desktopBehavior')}</Text>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text style={{ color: 'var(--semi-color-text-0)' }}>{t('tuning.connectAllOnStartup')}</Text>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 2 }}>{t('tuning.desktopOnly')}</Text>
          </div>
          <Select value={useSettingsStore((s) => s.settings.connectAllInstancesOnStartup ? 'yes' : 'no')}
            onChange={(v) => useSettingsStore.getState().updateSettings({ connectAllInstancesOnStartup: v === 'yes' })} style={{ width: 80 }} size="small">
            <Select.Option value="yes">{t('common.yes')}</Select.Option>
            <Select.Option value="no">{t('common.no')}</Select.Option>
          </Select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <div>
            <Text style={{ color: 'var(--semi-color-text-0)' }}>{t('tuning.openTuningOnStartup')}</Text>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 2 }}>{t('tuning.openTuningOnStartupDesc')}</Text>
          </div>
          <Select value={useSettingsStore((s) => s.settings.openTuningOnStartup ? 'yes' : 'no')}
            onChange={(v) => useSettingsStore.getState().updateSettings({ openTuningOnStartup: v === 'yes' })} style={{ width: 80 }} size="small">
            <Select.Option value="yes">{t('common.yes')}</Select.Option>
            <Select.Option value="no">{t('common.no')}</Select.Option>
          </Select>
        </div>
      </Card>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

interface TuningPageProps {
  embedded?: boolean;
}

export default function TuningPage({ embedded = false }: TuningPageProps = {}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('persona');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!embedded && (
        <div style={{ padding: '24px 28px 8px', flexShrink: 0 }}>
          <Title heading={3} style={{ marginBottom: 4 }}>{t('tuning.title')}</Title>
          <Text type="tertiary">{t('tuning.pageDesc')}</Text>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: embedded ? '12px 0 0' : '0 28px 28px', minHeight: 0 }}>
        <Tabs type="line" activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={t('tuning.memory')} itemKey="memory"><MemoryTab /></TabPane>
          <TabPane tab={t('tuning.persona')} itemKey="persona"><PersonaTab /></TabPane>
          <TabPane tab={t('tuning.communication')} itemKey="channels"><ChannelsTab /></TabPane>
          <TabPane tab={t('tuning.models')} itemKey="models"><ModelsTab /></TabPane>
          <TabPane tab={t('tuning.general')} itemKey="general"><GeneralTab /></TabPane>
        </Tabs>
      </div>
    </div>
  );
}
