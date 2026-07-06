import { isSafeWorkbenchTailActionWorkItemPath } from './workbench-matter';

export type DashboardTailActionRouteKind = 'status' | 'output' | 'knowledge' | 'review' | 'general';

export interface DashboardTailActionRouteContext {
  kind: DashboardTailActionRouteKind;
  id?: string;
  workItemPath?: string;
  assetRunPath?: string;
}

const TAIL_ACTION_KINDS = new Set<string>(['status', 'output', 'knowledge', 'review', 'general']);
const ASSET_RUN_PATH_IN_TEXT_PATTERN = /runs\/assets\/[^\s)`\]]+?\.md/g;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+]\(([^)]+)\)/g;

export function buildDashboardTailActionTarget(baseTarget: string, context: DashboardTailActionRouteContext): string {
  const search = new URLSearchParams();
  search.set('tailAction', context.kind);
  if (context.id) search.set('tailActionId', context.id);
  if (context.workItemPath) search.set('workItemPath', context.workItemPath);
  if (context.assetRunPath) search.set('assetRunPath', context.assetRunPath);
  return `${baseTarget}?${search.toString()}`;
}

export function parseDashboardTailActionRoute(search: string): DashboardTailActionRouteContext | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const kind = params.get('tailAction');
  if (!kind || !TAIL_ACTION_KINDS.has(kind)) return null;
  const assetRunPath = params.get('assetRunPath') ?? undefined;
  const workItemPath = params.get('workItemPath') ?? undefined;
  return {
    kind: kind as DashboardTailActionRouteKind,
    id: params.get('tailActionId') ?? undefined,
    workItemPath: workItemPath && isSafeWorkbenchTailActionWorkItemPath(workItemPath) ? workItemPath : undefined,
    assetRunPath: isSafeRepositoryAssetRunPath(assetRunPath) ? assetRunPath : undefined,
  };
}

export function isSafeRepositoryAssetRunPath(path: string | undefined): path is string {
  return isSafeRepositoryAssetRunPathValue(path);
}

export function isRepositoryAssetRunPathLike(path: string | undefined): boolean {
  return Boolean(path?.trim().replace(/^\/+/, '').startsWith('runs/assets/'));
}

function isSafeRepositoryAssetRunPathValue(path: string | undefined): boolean {
  if (!path || !path.startsWith('runs/assets/') || !path.endsWith('.md')) return false;
  const segments = path.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

export function extractSafeRepositoryAssetRunPathFromText(text: string, sourcePath?: string): string | undefined {
  for (const link of text.matchAll(MARKDOWN_LINK_PATTERN)) {
    const normalized = normalizeRepositoryAssetRunReference(link[1] ?? '', sourcePath);
    if (normalized) return normalized;
  }

  for (const match of text.matchAll(ASSET_RUN_PATH_IN_TEXT_PATTERN)) {
    const path = match[0];
    if (!hasRepositoryPathTokenBoundary(text, match.index ?? 0, path)) continue;
    if (isSafeRepositoryAssetRunPath(path)) return path;
  }

  return undefined;
}

function normalizeRepositoryAssetRunReference(value: string, sourcePath?: string): string | undefined {
  const trimmed = value.trim().replace(/^<|>$/g, '');
  if (isSafeRepositoryAssetRunPathValue(trimmed)) return trimmed;
  if (!sourcePath || !trimmed.startsWith('.')) return undefined;

  const base = sourcePath.split('/').slice(0, -1);
  const normalized: string[] = [];
  for (const segment of [...base, ...trimmed.split('/')]) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (normalized.length === 0) return undefined;
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }
  const path = normalized.join('/');
  return isSafeRepositoryAssetRunPathValue(path) ? path : undefined;
}

function hasRepositoryPathTokenBoundary(text: string, start: number, path: string): boolean {
  const before = text[start - 1];
  const after = text[start + path.length];
  return !isRepositoryPathTokenChar(before) && !isRepositoryPathTokenChar(after);
}

function isRepositoryPathTokenChar(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9_./-]/.test(value));
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
