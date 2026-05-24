import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Nav, Avatar, Button, Typography } from '@douyinfe/semi-ui';
import { InfiniteLoader, AutoSizer } from 'react-virtualized';
import VList from 'react-virtualized/dist/commonjs/List';
import {
  IconGithubLogo,
  IconPlus,
  IconServer,
  IconBranch,
  IconPieChart2Stroked,
  IconSearch,
  IconPlusCircle,
  IconPuzzle,
  IconCheckList,
  IconKanban,
  IconUserGroup,
  IconDesktop,
  IconBookmark,
  IconSun,
  IconMoon,
  IconSetting,
  IconFolderStroked,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import { useSettingsStore } from '../lib/settings-store';

const { Text } = Typography;

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/',
  search: '/search',
  'new-session': '/new-session',
  extensions: '/extensions',
  tasks: '/tasks',
  workspace: '/workspace',
  kanban: '/kanban',
  teams: '/teams',
  office: '/office',
  memory: '/memory',
  settings: '/settings',
};

interface SidebarProps {
  onAddInstance: () => void;
  onOpenDrawer: () => void;
}

function NavSectionLabel({ label }: { label: string }) {
  return (
    <li
      style={{
        padding: '14px 24px 4px',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--semi-color-text-2)',
        listStyle: 'none',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {label}
    </li>
  );
}

export default function Sidebar({ onAddInstance, onOpenDrawer }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const instances = useStore((s) => s.instances);
  const currentId = useStore((s) => s.currentInstanceId);
  const currentInstance = instances.find((i) => i.id === currentId);
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const userDisplayName = useSettingsStore((s) => s.settings.userDisplayName);
  const sessions = useStore((s) => s.sessions);
  const connectionStatus = useStore((s) => s.connectionStatus);

  useEffect(() => {
    useStore.getState().fetchSessions();
    useStore.getState().fetchGatewayUserForCurrent();
  }, [currentId]);

  const activeKey: string = (() => {
    const path = location.pathname;
    for (const [key, route] of Object.entries(ROUTE_MAP)) {
      if (path === route || (route !== '/' && path.startsWith(route))) {
        return key;
      }
    }
    return 'dashboard';
  })();

  const handleSelect = (data: { itemKey?: string | number }) => {
    const key = String(data.itemKey ?? '');
    const route = ROUTE_MAP[key];
    if (route) navigate(route);
  };

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    useSettingsStore.getState().updateSettings({ themeMode: next });
  };

  const openGitHub = () => {
    window.open('https://github.com/windinternet/openclaw-desktop', '_blank');
  };

  const instanceAvatar = currentInstance ? (
    <Avatar
      size="small"
      src={currentInstance.avatarUrl || undefined}
      style={{
        flexShrink: 0,
        backgroundColor: currentInstance.avatarUrl ? 'transparent' : 'rgb(var(--semi-blue-5))',
      }}
    >
      {currentInstance.name?.charAt(0).toUpperCase() ?? <IconServer />}
    </Avatar>
  ) : (
    <Avatar
      size="small"
      style={{
        flexShrink: 0,
        backgroundColor: 'var(--semi-color-primary-light-default)',
      }}
    >
      <IconServer size="small" />
    </Avatar>
  );

  const instanceHeaderText = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
        minWidth: 0,
        gap: 4,
      }}
    >
      <Text
        ellipsis
        style={{
          fontWeight: 600,
          color: 'var(--semi-color-text-0)',
          minWidth: 0,
        }}
      >
        {currentInstance?.name ?? t('nav.openclaw')}
      </Text>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <Button icon={<IconPlus />} size="small" theme="borderless" onClick={onAddInstance} />
        <Button icon={<IconBranch />} size="small" theme="borderless" onClick={onOpenDrawer} />
      </div>
    </div>
  );

  const gatewayUser = currentInstance?.gatewayUser;
  const displayName = connectionStatus === 'connected'
    ? (gatewayUser?.whatToCall || userDisplayName || currentInstance?.name || 'Operator')
    : connectionStatus === 'connecting'
      ? '连接中…'
      : connectionStatus === 'error'
        ? '连接失败'
        : (gatewayUser?.whatToCall || userDisplayName || currentInstance?.name || '未连接');
  const bioLine = gatewayUser?.notes?.split('\n')[0] ?? '';
  const fullNotes = gatewayUser?.notes ?? '';
  const hasPopover = !!(gatewayUser?.name || gatewayUser?.os || gatewayUser?.timezone || fullNotes);

  const popoverContent = (
    <div style={{ maxWidth: 260, fontSize: 13, lineHeight: 1.6 }}>
      {gatewayUser?.name && (
        <div style={{ marginBottom: 4 }}>
          <Text strong>{gatewayUser.name}</Text>
        </div>
      )}
      {gatewayUser?.os && <div style={{ color: 'var(--semi-color-text-2)' }}>🖥 {gatewayUser.os}</div>}
      {gatewayUser?.timezone && <div style={{ color: 'var(--semi-color-text-2)' }}>🕐 {gatewayUser.timezone}</div>}
      {fullNotes && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--semi-color-border)', color: 'var(--semi-color-text-1)', whiteSpace: 'pre-wrap' }}>
          {fullNotes}
        </div>
      )}
    </div>
  );

  const triggerRef = useRef<HTMLDivElement>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const calcPopover = useCallback((e?: React.MouseEvent) => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = 280;
    // 左：对齐导航菜单左内间距 24px
    const left = 24;
    // 上：鼠标距底部距离 + 10px
    const mouseY = e?.clientY ?? rect.bottom;
    const gapFromBottom = vh - mouseY + 10;
    const top = vh - gapFromBottom - 300;
    setPopoverStyle({ position: 'fixed', left: Math.min(left, vw - pw - 8), top: Math.max(8, top) });
  }, []);

  const showPopup = useCallback((e: React.MouseEvent) => {
    if (!hasPopover) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    calcPopover(e);
    setShowPopover(true);
  }, [hasPopover, calcPopover]);

  const hidePopup = useCallback(() => {
    hideTimer.current = setTimeout(() => setShowPopover(false), 150);
  }, []);

  const formatSessionName = (s: typeof sessions[0]): string => {
    if (s.title) return s.title;
    const key = s.key || '';
    // 主会话
    if (key === 'agent:main:main') return '主会话';
    // 飞书
    if (key.includes(':feishu:direct:')) return '飞书私聊';
    if (key.includes(':feishu:group:')) return '飞书群聊';
    // WebChat
    if (key.includes(':webchat:') || s.origin?.surface === 'webchat') return 'WebChat';
    // 定时任务
    if (key.includes(':cron:')) return '定时任务';
    // Dashboard 会话 → 取 ID 后 8 位
    if (key.includes(':dashboard:')) {
      const parts = key.split(':');
      const id = parts[parts.length - 1]?.slice(-8);
      return id ? `Dashboard #${id}` : 'Dashboard 会话';
    }
    // 兜底：取最后一段
    const parts = key.split(':');
    return parts[parts.length - 1]?.slice(0, 14) || key;
  };

  const formatRelativeTime = (ts?: number): string => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const currentSessionKey = location.pathname.startsWith('/chat/') ? location.pathname.replace('/chat/', '') : null;

  const footer = (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {sessions.length > 0 ? (
        <div style={{ flex: 1, borderTop: '1px solid var(--semi-color-border)' }}>
          <InfiniteLoader isRowLoaded={({ index }) => index < sessions.length} loadMoreRows={() => Promise.resolve()} rowCount={sessions.length}>
            {({ onRowsRendered, registerChild }) => (
              <AutoSizer>
                {({ width, height }) => (
                  <VList ref={registerChild} className="semi-light-scrollbar" height={height} onRowsRendered={onRowsRendered}
                    rowCount={sessions.length} rowHeight={44} width={width}
                    rowRenderer={({ index, key, style }) => {
                      const s = sessions[index];
                      if (!s) return null;
                      const isCurrent = s.key === currentSessionKey;
                      const isActive = s.status && s.status !== 'done' && s.status !== 'idle';
                      const isDone = s.status === 'done';
                      return (
                        <div key={key} style={{ ...style, padding: '0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          backgroundColor: isCurrent ? 'var(--semi-color-primary-light-default)' : 'transparent',
                        }} onClick={() => navigate(`/chat/${encodeURIComponent(s.key)}`)}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            backgroundColor: isActive ? 'var(--semi-color-success)' : isDone ? 'var(--semi-color-primary)' : 'transparent',
                            animation: isActive ? 'session-pulse 1.5s ease-in-out infinite' : 'none',
                          }} />
                          <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--semi-color-text-0)' }}>
                            {formatSessionName(s)}
                          </span>
                          {s.updatedAt && (
                            <span style={{ fontSize: 10, color: 'var(--semi-color-text-2)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              {formatRelativeTime(s.updatedAt)}
                            </span>
                          )}
                        </div>
                      );
                    }}
                  />
                )}
              </AutoSizer>
            )}
          </InfiniteLoader>
        </div>
      ) : (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--semi-color-border)', textAlign: 'center', flex: '1 1 auto' }}>
          <Text type="tertiary" size="small">{t('nav.sessions')}</Text>
        </div>
      )}
      <div style={{ width: '100%', borderTop: '1px solid var(--semi-color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 16px 6px', gap: 8 }}>
          <Avatar size="extra-small" src={currentInstance?.avatarUrl || undefined}
            style={{ flexShrink: 0, backgroundColor: currentInstance?.avatarUrl ? 'transparent' : 'var(--semi-color-primary-light-default)' }}>
            {currentInstance?.name?.charAt(0).toUpperCase() ?? <IconServer />}
          </Avatar>
          <div ref={triggerRef} onMouseEnter={showPopup} onMouseLeave={hidePopup}
            style={{ flex: 1, minWidth: 0, overflow: 'hidden', cursor: hasPopover ? 'default' : undefined }}>
            <Text ellipsis size="small" style={{ display: 'block', color: 'var(--semi-color-text-0)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </Text>
            {bioLine && (
              <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 11, lineHeight: '16px', marginTop: 2, color: 'var(--semi-color-text-2)', wordBreak: 'break-all' }}>
                {bioLine}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-evenly', padding: '4px 0 2px' }}>
          <Button icon={themeMode === 'dark' ? <IconSun size="small" /> : <IconMoon size="small" />} size="small" theme="borderless" onClick={toggleTheme} />
          <Button icon={<IconSetting size="small" />} size="small" theme="borderless" onClick={() => navigate('/settings')} />
          <Button icon={<IconGithubLogo size="small" />} size="small" theme="borderless" onClick={openGitHub} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <linearGradient id="ig-dashboard" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#818cf8"/></linearGradient>
          <linearGradient id="ig-search" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient>
          <linearGradient id="ig-new-session" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#34d399"/></linearGradient>
          <linearGradient id="ig-extensions" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#a78bfa"/></linearGradient>
          <linearGradient id="ig-tasks" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f43f5e"/><stop offset="100%" stopColor="#fb7185"/></linearGradient>
          <linearGradient id="ig-workspace" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0ea5a8"/><stop offset="100%" stopColor="#2dd4bf"/></linearGradient>
          <linearGradient id="ig-kanban" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#818cf8"/></linearGradient>
          <linearGradient id="ig-teams" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0ea5e9"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient>
          <linearGradient id="ig-office" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d946ef"/><stop offset="100%" stopColor="#f0abfc"/></linearGradient>
          <linearGradient id="ig-memory" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#eab308"/><stop offset="100%" stopColor="#fde047"/></linearGradient>
        </defs>
      </svg>
    <Nav
      mode="vertical"
      selectedKeys={[activeKey]}
      onSelect={handleSelect}
      style={{ flex: 1 }}
      header={{
        logo: instanceAvatar,
        text: instanceHeaderText,
      }}
      footer={footer}
    >
      <NavSectionLabel label={t('nav.sectionOverview')} />
      <Nav.Item itemKey="dashboard" text={t('nav.dashboard')} icon={<IconPieChart2Stroked />} />
      <Nav.Item itemKey="search" text={t('nav.search')} icon={<IconSearch />} />
      <Nav.Item itemKey="new-session" text={t('nav.newSession')} icon={<IconPlusCircle />} />

      <NavSectionLabel label={t('nav.sectionTools')} />
      <Nav.Item itemKey="extensions" text={t('nav.extensions')} icon={<IconPuzzle />} />
      <Nav.Item itemKey="tasks" text={t('nav.tasks')} icon={<IconCheckList />} />
      <Nav.Item itemKey="workspace" text={t('nav.workspace') || '工作区'} icon={<IconFolderStroked />} />
      <Nav.Item itemKey="kanban" text={t('nav.kanban')} icon={<IconKanban />} />

      <NavSectionLabel label={t('nav.sectionCollaboration')} />
      <Nav.Item itemKey="teams" text={t('nav.teams')} icon={<IconUserGroup />} />
      <Nav.Item itemKey="office" text={t('nav.office')} icon={<IconDesktop />} />
      <Nav.Item itemKey="memory" text={t('nav.memory')} icon={<IconBookmark />} />
    </Nav>
      {showPopover && createPortal(
        <div style={popoverStyle} onMouseEnter={showPopup} onMouseLeave={hidePopup}>
          <div style={{ background: 'var(--semi-color-bg-3)', borderRadius: 8, padding: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 280, maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
            {popoverContent}
          </div>
        </div>,
        document.body
      )}
      <style>{`
        @keyframes session-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
  </>
  );
}
