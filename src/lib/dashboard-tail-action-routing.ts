export type DashboardTailActionRouteKind = 'status' | 'output' | 'knowledge' | 'review' | 'general';

export interface DashboardTailActionRouteContext {
  kind: DashboardTailActionRouteKind;
  id?: string;
  workItemPath?: string;
}

const TAIL_ACTION_KINDS = new Set<string>(['status', 'output', 'knowledge', 'review', 'general']);

export function buildDashboardTailActionTarget(baseTarget: string, context: DashboardTailActionRouteContext): string {
  const search = new URLSearchParams();
  search.set('tailAction', context.kind);
  if (context.id) search.set('tailActionId', context.id);
  if (context.workItemPath) search.set('workItemPath', context.workItemPath);
  return `${baseTarget}?${search.toString()}`;
}

export function parseDashboardTailActionRoute(search: string): DashboardTailActionRouteContext | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const kind = params.get('tailAction');
  if (!kind || !TAIL_ACTION_KINDS.has(kind)) return null;
  return {
    kind: kind as DashboardTailActionRouteKind,
    id: params.get('tailActionId') ?? undefined,
    workItemPath: params.get('workItemPath') ?? undefined,
  };
}

export function getWorkbenchTailActionTab(context: DashboardTailActionRouteContext | null): string | undefined {
  if (!context) return undefined;
  if (context.kind === 'status') return 'tasks';
  if (context.kind === 'review') return 'reviews';
  if (context.kind === 'general') return 'dashboard';
  return undefined;
}

export function getKnowledgeTailActionTab(context: DashboardTailActionRouteContext | null): string | undefined {
  if (context?.kind === 'knowledge') return 'log';
  return undefined;
}
