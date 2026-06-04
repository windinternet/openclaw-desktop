import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, Typography, Tag, Button, Spin, Empty, Space, Card, Input, Select, Toast } from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconCalendar,
  IconSave,
  IconEdit,
  IconClose,
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

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y} 年 ${parseInt(m, 10)} 月 ${parseInt(d, 10)} 日`;
}

function MemoryTab() {
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
          <Space><IconCalendar size="small" /><Text weight={600}>{dateStr ? formatDateLabel(dateStr) : file.name}</Text>{isToday && <Tag color="blue" size="small">今天</Tag>}</Space>
          <Space>
            {file.modifiedAt && <Text size="small" type="tertiary">{new Date(file.modifiedAt).toLocaleDateString()}</Text>}
            {file.size !== undefined && <Text size="small" type="tertiary">{file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`}</Text>}
            {!isExpanded && !isLoadingContent && <Text type="tertiary" size="small">点击查看</Text>}
            {isLoadingContent && <Spin size="small" />}
          </Space>
        </div>
        {isExpanded && content && <div style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--semi-color-text-0)', padding: 16, backgroundColor: 'var(--semi-color-bg-0)', borderTop: '1px solid var(--semi-color-border)', fontFamily: 'monospace' }}>{content}</div>}
        {isExpanded && !content && !isLoadingContent && <div style={{ padding: 16, borderTop: '1px solid var(--semi-color-border)' }}><Text type="tertiary">无内容</Text></div>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div><Text strong style={{ fontSize: 15 }}>记忆概览</Text><Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>Agent 每天自动生成，记录对话中的重要信息</Text></div>
        <Button icon={<IconRefresh />} onClick={handleRefresh} loading={loading} theme="outline" size="small">刷新</Button>
      </div>
      <div style={{ marginBottom: 20, padding: 16, borderRadius: 8, border: '1px solid var(--semi-color-border)', backgroundColor: 'var(--semi-color-bg-1)', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div><Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>连接状态</Text><Tag color={isConnected ? 'green' : 'red'}>{isConnected ? '已连接' : '未连接'}</Tag></div>
        <div><Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>记忆文件</Text><Tag color={memoryFiles.length > 0 ? 'blue' : 'grey'}>{memoryFiles.length} 个</Tag></div>
        <div><Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>今日记忆</Text><Tag color={todayFiles.length > 0 ? 'green' : 'grey'}>{todayFiles.length > 0 ? `${todayFiles.length} 条` : '无'}</Tag></div>
      </div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin tip="加载记忆中…" /></div>}
      {!isConnected && !loading && <Empty description="未连接到 Gateway，无法读取记忆" style={{ marginTop: 48 }} />}
      {isConnected && !loading && memoryFiles.length === 0 && <Empty description="尚无记忆文件" style={{ marginTop: 48 }} />}
      {todayFiles.length > 0 && <div style={{ marginBottom: 24 }}><Text strong style={{ display: 'block', marginBottom: 12 }}>今日记忆 <Tag size="small" color="blue">{today}</Tag></Text>{todayFiles.map((f) => renderMemoryEntry(f, true))}</div>}
      {yesterdayFiles.length > 0 && <div style={{ marginBottom: 24 }}><Text strong style={{ display: 'block', marginBottom: 12 }}>昨日记忆 <Tag size="small">{yesterday}</Tag></Text>{yesterdayFiles.map((f) => renderMemoryEntry(f, false))}</div>}
      {olderFiles.length > 0 && <div style={{ marginBottom: 24 }}><Text strong style={{ display: 'block', marginBottom: 12 }}>历史记忆 <Tag size="small">{olderFiles.length} 条</Tag></Text>{olderFiles.map((f) => renderMemoryEntry(f, false))}</div>}
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
      Toast.success('已更新 AI 名称');
      setEditingAssistant(false);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingAssistant(false);
    }
  }, [activeClient, agentIdentity?.agentId, assistantDraft]);

  const saveUser = useCallback(async () => {
    if (!activeClient || !userDraft.trim()) return;
    setSavingUser(true);
    try {
      await activeClient.request('gateway.user.set', { whatToCall: userDraft.trim() });
      await useStore.getState().fetchGatewayUserForCurrent();
      updateSettings({ userDisplayName: userDraft.trim() });
      Toast.success('已更新称呼');
      setEditingUser(false);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingUser(false);
    }
  }, [activeClient, userDraft, updateSettings]);

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
      const bootstrap = (config?.agents as Record<string, unknown>)?.defaults as Record<string, unknown> | undefined;
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
      Toast.success(`已应用「${preset.name}」预设`);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '应用预设失败');
    } finally { setApplying(null); }
  }, [activeClient, isConnected]);

  const saveCustomValues = useCallback(async () => {
    if (!activeClient || !isConnected) return;
    const pf = parseInt(draftPerFile, 10); const tot = parseInt(draftTotal, 10);
    if (!pf || !tot || pf < 1000 || tot < 1000) { Toast.warning('请输入有效的数值（至少 1000 字符）'); return; }
    setSaving(true);
    try {
      await activeClient.request('config.patch', { raw: { agents: { defaults: { bootstrapMaxFileChars: pf, bootstrapMaxTotalChars: tot, bootstrapFollowUp: draftFollowUp } } } });
      setPerFileChars(pf); setTotalChars(tot); setFollowUp(draftFollowUp);
      const match = CONTEXT_PRESETS.find((p) => p.perFileChars === pf && p.totalChars === tot && p.followUp === draftFollowUp);
      setCurrentPresetId(match ? match.id : null);
      Toast.success('已保存');
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '保存失败');
    } finally { setSaving(false); }
  }, [activeClient, isConnected, draftPerFile, draftTotal, draftFollowUp]);

  const dirty = perFileChars != null && (String(perFileChars) !== draftPerFile || String(totalChars) !== draftTotal || (followUp || 'every-turn') !== draftFollowUp);
  const currentPreset = currentPresetId ? CONTEXT_PRESETS.find((p) => p.id === currentPresetId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 15 }}>Context Profile</Text>
        {!isConnected && <Tag color="orange">未连接 Gateway</Tag>}
      </div>

      {/* Identity */}
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            {editingAssistant ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text type="tertiary" size="small">AI 助手名称</Text>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input value={assistantDraft} onChange={setAssistantDraft} size="small" style={{ flex: 1 }} />
                  <Button size="small" type="primary" icon={<IconSave />} onClick={saveAssistant} loading={savingAssistant} />
                  <Button size="small" icon={<IconClose />} onClick={() => setEditingAssistant(false)} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--semi-color-primary-light-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--semi-color-primary)' }}>
                    {assistantName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Text strong>{assistantName}</Text>
                    {agentIdentity?.emoji && <Text style={{ marginLeft: 6 }}>{agentIdentity.emoji}</Text>}
                    <Text type="tertiary" size="small" style={{ display: 'block' }}>Agent ID: {agentIdentity?.agentId || 'main'}</Text>
                  </div>
                </div>
                <Button icon={<IconEdit />} size="small" theme="borderless" onClick={() => { setAssistantDraft(assistantName); setEditingAssistant(true); }} />
              </div>
            )}
          </div>
          <div>
            {editingUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text type="tertiary" size="small">你的称呼</Text>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input value={userDraft} onChange={setUserDraft} size="small" style={{ flex: 1 }} />
                  <Button size="small" type="primary" icon={<IconSave />} onClick={saveUser} loading={savingUser} />
                  <Button size="small" icon={<IconClose />} onClick={() => setEditingUser(false)} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--semi-color-fill-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                  <div>
                    <Text strong>{displayName}</Text>
                    {gatewayUser?.timezone && <Text type="tertiary" size="small" style={{ display: 'block' }}>🕐 {gatewayUser.timezone}</Text>}
                    {gatewayUser?.os && <Text type="tertiary" size="small" style={{ display: 'block' }}>🖥 {gatewayUser.os}</Text>}
                  </div>
                </div>
                <Button icon={<IconEdit />} size="small" theme="borderless" onClick={() => { setUserDraft(displayName); setEditingUser(true); }} />
              </div>
            )}
          </div>
        </div>
      </Card>

      {!isConnected && <Empty description="未连接到 Gateway" style={{ marginTop: 48 }} />}

      {isConnected && (
        <>
          {/* Editable fields */}
          <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: currentPreset ? 'var(--semi-color-success)' : 'var(--semi-color-primary)', display: 'inline-block' }} />
                <Text strong size="small">{currentPreset ? `当前预设: ${currentPreset.name}` : 'Current Values'}</Text>
              </div>
              <Space>
                <Button icon={<IconRefresh />} onClick={loadConfig} loading={loading} size="small" theme="borderless" />
                <Button icon={<IconSave />} size="small" type="primary" onClick={saveCustomValues} loading={saving} disabled={!dirty}>保存</Button>
              </Space>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>Bootstrap Per File</Text>
                <Input value={draftPerFile} onChange={setDraftPerFile} size="small" placeholder="12000" />
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>单个引导文件最大注入字符数</Text>
              </div>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>Bootstrap Total</Text>
                <Input value={draftTotal} onChange={setDraftTotal} size="small" placeholder="60000" />
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>所有引导文件合计最大字符数</Text>
              </div>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>Follow-up Turns</Text>
                <Select value={draftFollowUp} onChange={(v) => setDraftFollowUp(v as string)} size="small" style={{ width: '100%' }}>
                  <Select.Option value="every-turn">Every turn</Select.Option>
                  <Select.Option value="skip-safe">Skip safe follow-ups</Select.Option>
                </Select>
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>安全跟进时可跳过上下文注入</Text>
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
                    <span>{preset.perFileChars.toLocaleString()} /文件</span>
                    <span>{preset.totalChars.toLocaleString()} 总计</span>
                    <span>{preset.followUp === 'every-turn' ? '每轮' : '跳过'}</span>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {active ? <Tag color="green" size="small">当前</Tag> : <Tag color="blue" size="small" style={{ opacity: 0 }}>&nbsp;</Tag>}
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

function ChannelsTab() {
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;

  const channels = useMemo<ChannelInfo[]>(() => [
    { id: 'whatsapp', enabled: true, connected: false, accounts: [{ id: 'default', name: 'Default', connected: false }] },
    { id: 'telegram', enabled: true, connected: false, accounts: [{ id: 'default', name: 'Default', connected: false }] },
    { id: 'discord', enabled: false, connected: false },
    { id: 'slack', enabled: false, connected: false },
    { id: 'signal', enabled: false, connected: false },
    { id: 'imessage', enabled: false, connected: false },
    { id: 'feishu', enabled: true, connected: true, accounts: [{ id: 'default', name: '飞书', connected: true, lastSeen: Date.now() - 30000 }] },
    { id: 'matrix', enabled: false, connected: false },
    { id: 'webchat', enabled: true, connected: true, accounts: [{ id: 'default', name: 'WebChat', connected: true }] },
    { id: 'line', enabled: false, connected: false },
  ], []);

  const channelStatusColors: Record<string, string> = {
    whatsapp: '#25D366', telegram: '#26A5E4', discord: '#5865F2', slack: '#4A154B', signal: '#3B45FD',
    imessage: '#34C759', feishu: '#3370FF', matrix: '#2D2D2D', webchat: '#6366F1', line: '#06C755',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><Text strong style={{ fontSize: 15 }}>消息渠道</Text><Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>管理 OpenClaw 连接的消息平台</Text></div>
        {!isConnected && <Tag color="orange">未连接 Gateway</Tag>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {channels.map((ch) => {
          const connected = ch.connected || (ch.accounts?.some((a) => a.connected) ?? false);
          const color = channelStatusColors[ch.id] || 'var(--semi-color-text-2)';
          return (
            <div key={ch.id} style={{ padding: 16, borderRadius: 8, border: `1px solid ${connected ? color : 'var(--semi-color-border)'}`, backgroundColor: 'var(--semi-color-bg-1)', borderLeft: `4px solid ${ch.enabled ? color : 'var(--semi-color-border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ textTransform: 'capitalize' }}>{ch.id}</Text>
                <Tag color={connected ? 'green' : ch.enabled ? 'blue' : 'grey'} size="small">{connected ? '已连接' : ch.enabled ? '已启用' : '未启用'}</Tag>
              </div>
              {ch.accounts?.map((acc) => (
                <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text size="small" type="tertiary">{acc.name}</Text>
                  <Tag color={acc.connected ? 'green' : 'grey'} size="small">{acc.connected ? '在线' : '离线'}</Tag>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>消息策略</Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>DM 隔离策略</Text>
            <Select defaultValue="per-channel-peer" style={{ width: 240 }} size="small">
              <Select.Option value="main">所有 DM 共享会话</Select.Option>
              <Select.Option value="per-peer">按发送者隔离</Select.Option>
              <Select.Option value="per-channel-peer">按渠道+发送者隔离 (推荐)</Select.Option>
              <Select.Option value="per-account-channel-peer">按账户+渠道+发送者隔离</Select.Option>
            </Select>
          </div>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>DM 安全策略</Text>
            <Select defaultValue="pairing" style={{ width: 240 }} size="small">
              <Select.Option value="pairing">配对模式 (推荐)</Select.Option>
              <Select.Option value="open">开放模式</Select.Option>
            </Select>
          </div>
        </div>
      </Card>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>会话设置</Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>每日重置时间</Text>
            <Select defaultValue="04:00" style={{ width: 180 }} size="small">
              <Select.Option value="00:00">00:00</Select.Option>
              <Select.Option value="04:00">04:00 (默认)</Select.Option>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Models Tab ────────────────────────────────────────────────── */

function ModelsTab() {
  const models = useStore((s) => s.models);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;
  const fetchModels = useStore((s) => s.fetchModels);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (models.length === 0 && isConnected) { setLoading(true); fetchModels().finally(() => setLoading(false)); }
  }, [isConnected]);

  const handleRefresh = useCallback(async () => { setLoading(true); await fetchModels(); setLoading(false); }, [fetchModels]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><Text strong style={{ fontSize: 15 }}>模型管理</Text><Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>管理 AI 大模型的接入与默认配置</Text></div>
        <Space>{!isConnected && <Tag color="orange">未连接</Tag>}<Button icon={<IconRefresh />} onClick={handleRefresh} loading={loading} theme="outline" size="small">刷新</Button></Space>
      </div>
      {!isConnected && !loading && <Empty description="未连接到 Gateway" style={{ marginTop: 48 }} />}
      {loading && <Spin tip="加载模型列表…" />}
      {!loading && models.length > 0 && (
        <>
          <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>已接入模型 <Tag color="green" size="small">{models.length}</Tag></Text>
            <div style={{ display: 'grid', gap: 8 }}>
              {models.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--semi-color-border)', backgroundColor: 'var(--semi-color-fill-0)' }}>
                  <div>
                    <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.id}</Text>
                    {(m.name || m.alias) && <Text type="tertiary" size="small" style={{ display: 'block' }}>{m.name || m.alias}</Text>}
                  </div>
                  <Space>{m.vision && <Tag color="violet" size="small">视觉</Tag>}{m.thinking && <Tag color="blue" size="small">思维链</Tag>}<Tag color="green" size="small">已接入</Tag></Space>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>默认模型</Text>
            <Select value={models[0]?.id} style={{ width: 280 }} size="small">
              {models.map((m) => (<Select.Option key={m.id} value={m.id}>{m.name || m.alias || m.id}</Select.Option>))}
            </Select>
          </Card>
        </>
      )}
    </div>
  );
}

/* ── General Tab ───────────────────────────────────────────────── */

function GeneralTab() {
  const currentInstance = useStore((s) => s.instances.find((i) => i.id === s.currentInstanceId) ?? null);
  const health = useStore((s) => s.health);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div><Text strong style={{ fontSize: 15 }}>通用配置</Text><Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>Gateway 网络绑定、认证、SSL 等基础设置</Text></div>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>当前连接</Text>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            ['Gateway 地址', currentInstance?.gatewayUrl || '—'],
            ['连接状态', isConnected ? '已连接' : '未连接'],
            ['实例名称', currentInstance?.name || '—'],
            ['认证模式', 'Token'],
            ['Gateway 版本', health?.version || '—'],
            ['运行时长', formatUptime(health?.uptime)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
              <Text type="tertiary" size="small">{label}</Text>
              <Text style={{ fontFamily: typeof value === 'string' && value.includes('已连接') || value === '未连接' ? undefined : 'monospace', fontSize: 13 }}>{value}</Text>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>网络</Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>绑定模式</Text>
            <Select defaultValue="loopback" style={{ width: 200 }} size="small">
              <Select.Option value="loopback">仅本地 Loopback</Select.Option>
              <Select.Option value="lan">局域网 LAN</Select.Option>
              <Select.Option value="tailnet">Tailscale 网络</Select.Option>
            </Select>
          </div>
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>控制端口</Text>
            <Input defaultValue="18789" style={{ width: 140 }} size="small" disabled />
          </div>
        </div>
      </Card>
      <Card style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, backgroundColor: 'var(--semi-color-bg-1)' }} bodyStyle={{ padding: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 16 }}>Desktop 行为</Text>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><Text style={{ color: 'var(--semi-color-text-0)' }}>启动时自动连接所有实例</Text></div>
          <Select value={useSettingsStore((s) => s.settings.connectAllInstancesOnStartup ? 'yes' : 'no')}
            onChange={(v) => useSettingsStore.getState().updateSettings({ connectAllInstancesOnStartup: v === 'yes' })} style={{ width: 80 }} size="small">
            <Select.Option value="yes">是</Select.Option>
            <Select.Option value="no">否</Select.Option>
          </Select>
        </div>
      </Card>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function TuningPage() {
  const [activeTab, setActiveTab] = useState('persona');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '24px 28px 8px', flexShrink: 0 }}>
        <Title heading={3} style={{ marginBottom: 4 }}>调教</Title>
        <Text type="tertiary">管理 Agent 人设、记忆、通信渠道、模型接入与 Gateway 配置</Text>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px', minHeight: 0 }}>
        <Tabs type="line" activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="记忆" itemKey="memory"><MemoryTab /></TabPane>
          <TabPane tab="人设" itemKey="persona"><PersonaTab /></TabPane>
          <TabPane tab="通信" itemKey="channels"><ChannelsTab /></TabPane>
          <TabPane tab="模型" itemKey="models"><ModelsTab /></TabPane>
          <TabPane tab="通用" itemKey="general"><GeneralTab /></TabPane>
        </Tabs>
      </div>
    </div>
  );
}
