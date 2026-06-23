export type PrimaryNavKey =
  | 'dashboard'
  | 'new-session'
  | 'sessions'
  | 'workbench'
  | 'knowledge'
  | 'collaboration'
  | 'control-center';

export interface PrimaryNavItem {
  key: PrimaryNavKey;
  labelKey: string;
  route: string;
  icon:
    | 'dashboard'
    | 'new-session'
    | 'sessions'
    | 'workbench'
    | 'knowledge'
    | 'collaboration'
    | 'control-center';
}

export interface PrimaryNavGroup {
  key: 'overview' | 'work' | 'agents';
  labelKey: string;
  items: PrimaryNavItem[];
}

export const NAV_GROUPS: PrimaryNavGroup[] = [
  {
    key: 'overview',
    labelKey: 'nav.sectionOverview',
    items: [
      { key: 'dashboard', labelKey: 'nav.dashboard', route: '/', icon: 'dashboard' },
    ],
  },
  {
    key: 'work',
    labelKey: 'nav.sectionWork',
    items: [
      { key: 'new-session', labelKey: 'nav.newSession', route: '/new-session', icon: 'new-session' },
      { key: 'sessions', labelKey: 'nav.sessions', route: '/sessions', icon: 'sessions' },
      { key: 'workbench', labelKey: 'nav.workbench', route: '/workbench', icon: 'workbench' },
      { key: 'knowledge', labelKey: 'nav.knowledge', route: '/knowledge', icon: 'knowledge' },
    ],
  },
  {
    key: 'agents',
    labelKey: 'nav.sectionAgents',
    items: [
      { key: 'collaboration', labelKey: 'nav.collaboration', route: '/collaboration', icon: 'collaboration' },
      { key: 'control-center', labelKey: 'nav.controlCenter', route: '/control-center', icon: 'control-center' },
    ],
  },
];

export const PRIMARY_ROUTE_MAP: Record<PrimaryNavKey, string> = NAV_GROUPS
  .flatMap((group) => group.items)
  .reduce<Record<PrimaryNavKey, string>>((map, item) => {
    map[item.key] = item.route;
    return map;
  }, {} as Record<PrimaryNavKey, string>);

const LEGACY_ROUTE_ACTIVE_KEYS: Array<{ prefix: string; key: PrimaryNavKey }> = [
  { prefix: '/chat/', key: 'sessions' },
  { prefix: '/search', key: 'sessions' },
  { prefix: '/taskkanban', key: 'workbench' },
  { prefix: '/actions', key: 'workbench' },
  { prefix: '/artifacts', key: 'workbench' },
  { prefix: '/teams', key: 'collaboration' },
  { prefix: '/office', key: 'collaboration' },
  { prefix: '/extensions', key: 'control-center' },
  { prefix: '/tuning', key: 'control-center' },
  { prefix: '/settings', key: 'control-center' },
];

export function getActiveNavKey(pathname: string): PrimaryNavKey {
  if (pathname === '/') return 'dashboard';

  const direct = NAV_GROUPS
    .flatMap((group) => group.items)
    .find((item) => item.route !== '/' && (pathname === item.route || pathname.startsWith(item.route + '/')));

  if (direct) return direct.key;

  const legacy = LEGACY_ROUTE_ACTIVE_KEYS.find((item) => pathname === item.prefix || pathname.startsWith(item.prefix));
  return legacy?.key ?? 'dashboard';
}
