import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Typography,
  Select,
  Input,
  Button,
  Tag,
  Space,
  Switch,
} from '@douyinfe/semi-ui';
import { useSettingsStore } from '../lib/settings-store';
import { PRESET_THEME_COLORS } from '../lib/settings-types';
import type { ThemeMode, SupportedLocale } from '../lib/settings-types';
import type { AgentSwitchStrategy, InstanceAgentSwitchStrategy } from '../lib/agent-switch-settings';
import type { AssistantReplyGrouping, SessionToolCallDisplay } from '../lib/session-content';
import { useStore } from '../lib';

const { Title, Text } = Typography;

/* ── Theme mode options ── */
const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'settings.light' },
  { value: 'dark', label: 'settings.dark' },
  { value: 'auto', label: 'settings.auto' },
];

/* ── Language options ── */
const LOCALE_OPTIONS: { value: SupportedLocale; label: string }[] = [
  { value: 'zh-CN', label: 'settings.chinese' },
  { value: 'en-US', label: 'settings.english' },
];

const AGENT_SWITCH_OPTIONS: AgentSwitchStrategy[] = ['new-session', 'subagent-session'];
const INSTANCE_AGENT_SWITCH_OPTIONS: InstanceAgentSwitchStrategy[] = [
  'inherit',
  'new-session',
  'subagent-session',
];
const SESSION_TOOL_CALL_DISPLAY_OPTIONS: SessionToolCallDisplay[] = ['hidden', 'compact'];
const ASSISTANT_REPLY_GROUPING_OPTIONS: AssistantReplyGrouping[] = ['merged', 'message-boundary'];

/* ── Section wrapper ── */
function SectionCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      style={{
        border: '1px solid var(--semi-color-border)',
        borderRadius: 12,
        backgroundColor: 'var(--semi-color-bg-1)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
            <Text strong style={{ fontSize: 15 }}>
              {title}
            </Text>
          </div>
          {desc && (
            <Text
              type="tertiary"
              size="small"
              style={{ display: 'block', marginLeft: 28 }}
            >
              {desc}
            </Text>
          )}
        </div>
        <div style={{ paddingLeft: 28 }}>{children}</div>
      </div>
    </Card>
  );
}

/* ── Page ── */

export default function SettingsPage() {
  const { t } = useTranslation();

  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  const health = useStore((s) => s.health);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const currentInstance = useStore((s) =>
    s.instances.find((instance) => instance.id === s.currentInstanceId) ?? null,
  );
  const updateInstancePreferences = useStore((s) => s.updateInstancePreferences);

  /* ── About info ── */
  const appVersion = '0.1.0';
  const electronVersion = (window as any)?.electron?.version ?? '—';
  const chromeVersion = navigator?.userAgent?.match(/Chrome\/([\d.]+)/)?.[1] ?? '—';

  const isConnected = connectionStatus === 'connected';

  /* ── Theme mode click handler ── */
  const handleModeChange = useCallback(
    (mode: ThemeMode) => {
      updateSettings({ themeMode: mode });
    },
    [updateSettings],
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '24px 28px 8px',
          flexShrink: 0,
        }}
      >
        <Title heading={3} style={{ margin: 0 }}>
          {t('settings.title')}
        </Title>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 28px', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ═══ Theme ═══ */}
        <SectionCard icon="🎨" title={t('settings.theme')} desc={t('settings.themeDesc')}>
          {/* Mode selector */}
          <div style={{ marginBottom: 20 }}>
            <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>
              {t('settings.mode')}
            </Text>
            <div style={{ display: 'flex', gap: 8 }}>
              {THEME_OPTIONS.map((opt) => {
                const isActive = settings.themeMode === opt.value;
                return (
                  <div
                    key={opt.value}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleModeChange(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleModeChange(opt.value);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: `1.5px solid ${
                        isActive ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'
                      }`,
                      backgroundColor: isActive
                        ? 'var(--semi-color-primary-light-default)'
                        : 'var(--semi-color-fill-0)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'border-color 0.2s, background-color 0.2s',
                      outline: 'none',
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive
                        ? 'var(--semi-color-primary)'
                        : 'var(--semi-color-text-0)',
                    }}
                  >
                    {t(opt.label)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accent color */}
          <div>
            <Text size="small" style={{ display: 'block', marginBottom: 10, color: 'var(--semi-color-text-1)' }}>
              {t('settings.accentColor')}
            </Text>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {PRESET_THEME_COLORS.map((color) => {
                const isActive = settings.themeColor === color.name;
                return (
                  <div
                    key={color.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => updateSettings({ themeColor: color.name })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') updateSettings({ themeColor: color.name });
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        backgroundColor: color.value,
                        border: isActive
                          ? '2px solid var(--semi-color-text-0)'
                          : '2px solid transparent',
                        boxShadow: isActive ? `0 0 0 3px ${color.value}50` : 'none',
                        transition: 'box-shadow 0.2s, border-color 0.2s',
                      }}
                    />
                    <Text
                      size="small"
                      style={{
                        textTransform: 'capitalize',
                        fontSize: 11,
                        color: isActive
                          ? 'var(--semi-color-primary)'
                          : 'var(--semi-color-text-2)',
                      }}
                    >
                      {color.name}
                    </Text>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* ═══ Language ═══ */}
        <SectionCard icon="🌐" title={t('settings.language')} desc={t('settings.languageDesc')}>
          <Select
            value={settings.locale}
            onChange={(val: any) => updateSettings({ locale: val as SupportedLocale })}
            style={{ width: 200 }}
          >
            {LOCALE_OPTIONS.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </Select.Option>
            ))}
          </Select>
        </SectionCard>

        {/* ═══ User ═══ */}
        <SectionCard icon="👤" title={t('settings.user')} desc={t('settings.userDesc')}>
          <Input
            placeholder={t('settings.displayNamePlaceholder')}
            value={settings.userDisplayName}
            onChange={(val: string) => updateSettings({ userDisplayName: val })}
            style={{ maxWidth: 320 }}
          />
        </SectionCard>

        {/* ═══ Connections ═══ */}
        <SectionCard icon="🔗" title={t('settings.connections')} desc={t('settings.connectionsDesc')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ minWidth: 0 }}>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-0)' }}>
                {t('settings.connectAllInstancesOnStartup')}
              </Text>
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                {t('settings.connectAllInstancesOnStartupDesc')}
              </Text>
            </div>
            <Switch
              checked={settings.connectAllInstancesOnStartup}
              onChange={(checked: boolean) => updateSettings({ connectAllInstancesOnStartup: checked })}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ minWidth: 0 }}>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-0)' }}>
                {t('settings.externalLinkMode')}
              </Text>
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                {t('settings.externalLinkModeDesc')}
              </Text>
            </div>
            <Select
              value={settings.externalLinkMode ?? 'system'}
              onChange={(val: any) => {
                updateSettings({ externalLinkMode: val as 'system' | 'internal' });
                (window as any).electronAPI?.setExternalLinkMode?.(val);
              }}
              style={{ width: 140 }}
            >
              <Select.Option value="system">{t('settings.systemBrowser')}</Select.Option>
              <Select.Option value="internal">{t('settings.internalWindow')}</Select.Option>
            </Select>
          </div>
        </SectionCard>

        <SectionCard
          icon="💬"
          title={t('settings.sessionMessageDisplay')}
          desc={t('settings.sessionMessageDisplayDesc')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>
                {t('settings.sessionToolCallDisplay')}
              </Text>
              <Select
                value={settings.sessionToolCallDisplay}
                onChange={(value: unknown) =>
                  updateSettings({ sessionToolCallDisplay: value as SessionToolCallDisplay })
                }
                style={{ width: 280 }}
              >
                {SESSION_TOOL_CALL_DISPLAY_OPTIONS.map((value) => (
                  <Select.Option key={value} value={value}>
                    {t(`settings.sessionToolCallDisplayOptions.${value}`)}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>
                {t('settings.assistantReplyGrouping')}
              </Text>
              <Select
                value={settings.assistantReplyGrouping}
                onChange={(value: unknown) =>
                  updateSettings({ assistantReplyGrouping: value as AssistantReplyGrouping })
                }
                style={{ width: 280 }}
              >
                {ASSISTANT_REPLY_GROUPING_OPTIONS.map((value) => (
                  <Select.Option key={value} value={value}>
                    {t(`settings.assistantReplyGroupingOptions.${value}`)}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <Text type="tertiary" size="small" style={{ display: 'block', maxWidth: 620 }}>
              {t('settings.sessionMessageDisplayOpenClawFact')}
            </Text>
          </div>
        </SectionCard>

        <SectionCard
          icon="🤖"
          title={t('settings.agentSwitching')}
          desc={t('settings.agentSwitchingDesc')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>
                {t('settings.agentSwitchStrategy')}
              </Text>
              <Select
                value={settings.agentSwitchStrategy}
                onChange={(value: unknown) =>
                  updateSettings({ agentSwitchStrategy: value as AgentSwitchStrategy })
                }
                style={{ width: 280 }}
              >
                {AGENT_SWITCH_OPTIONS.map((value) => (
                  <Select.Option key={value} value={value}>
                    {t(`settings.agentSwitchStrategyOptions.${value}`)}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <Text size="small" style={{ display: 'block', marginBottom: 8, color: 'var(--semi-color-text-1)' }}>
                {t('settings.currentInstanceAgentSwitchStrategy')}
              </Text>
              <Select
                disabled={!currentInstance}
                value={currentInstance?.agentSwitchStrategy ?? 'inherit'}
                onChange={(value: unknown) => {
                  if (!currentInstance) return;
                  updateInstancePreferences(currentInstance.id, {
                    agentSwitchStrategy: value as InstanceAgentSwitchStrategy,
                  });
                }}
                style={{ width: 280 }}
              >
                {INSTANCE_AGENT_SWITCH_OPTIONS.map((value) => (
                  <Select.Option key={value} value={value}>
                    {t(`settings.agentSwitchStrategyOptions.${value}`)}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <Text type="tertiary" size="small" style={{ display: 'block', maxWidth: 620 }}>
              {t('settings.subagentSessionLimitation')}
            </Text>
          </div>
        </SectionCard>

        {/* ═══ About ═══ */}
        <SectionCard icon="ℹ️" title={t('settings.about')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InfoRow label={t('settings.appVersion')} value={appVersion} />
            <InfoRow label={t('settings.electronVersion')} value={electronVersion} />
            <InfoRow label={t('settings.chromeVersion')} value={chromeVersion} />
            <InfoRow
              label={t('settings.gateway')}
              value={
                <Space>
                  <Tag color={isConnected ? 'green' : 'orange'} size="small">
                    {isConnected ? t('settings.connected') : t('settings.disconnected')}
                  </Tag>
                  {health?.version && (
                    <Text size="small" type="tertiary">
                      {t('settings.serverVersion')}: {health.version}
                    </Text>
                  )}
                </Space>
              }
            />
          </div>
        </SectionCard>

        {/* Reset */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <Button
            theme="borderless"
            type="danger"
            size="small"
            onClick={() => resetSettings()}
          >
            {t('settings.reset')}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ── InfoRow ── */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid var(--semi-color-border)',
      }}
    >
      <Text size="small" type="tertiary" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--semi-color-text-0)' }}>
        {value}
      </div>
    </div>
  );
}
