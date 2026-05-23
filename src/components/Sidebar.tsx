import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Nav, Avatar, Button, Typography } from '@douyinfe/semi-ui';
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

  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {sessions.length > 0 ? (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 12px',
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <Text
            type="tertiary"
            size="small"
            style={{ fontWeight: 600, display: 'block', marginBottom: 4, paddingLeft: 12 }}
          >
            {t('nav.sessions')}
          </Text>
          {sessions.map((s) => (
            <div
              key={s.key}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/chat/${s.key}`)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--semi-color-text-0)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.title || s.key}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--semi-color-border)',
            textAlign: 'center',
            flex: '1 1 auto',
          }}
        >
          <Text type="tertiary" size="small">
            {t('nav.sessions')}
          </Text>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderTop: '1px solid var(--semi-color-border)',
          gap: 4,
        }}
      >
        <Avatar
          size="extra-small"
          src={currentInstance?.avatarUrl || undefined}
          style={{
            flexShrink: 0,
            backgroundColor: currentInstance?.avatarUrl ? 'transparent' : 'var(--semi-color-primary-light-default)',
          }}
        >
          {currentInstance?.name?.charAt(0).toUpperCase() ?? <IconServer />}
        </Avatar>
        <Text ellipsis size="small" style={{ flex: 1, minWidth: 0, color: 'var(--semi-color-text-0)' }}>
          {currentInstance?.gatewayUser?.whatToCall || userDisplayName || currentInstance?.name || 'Operator'}
        </Text>
        <Button
          icon={themeMode === 'dark' ? <IconSun size="small" /> : <IconMoon size="small" />}
          size="small"
          theme="borderless"
          onClick={toggleTheme}
        />
        <Button icon={<IconSetting size="small" />} size="small" theme="borderless" onClick={() => navigate('/settings')} />
        <Button icon={<IconGithubLogo size="small" />} size="small" theme="borderless" onClick={openGitHub} />
      </div>
    </div>
  );

  return (
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
  );
}
