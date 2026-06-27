import type {
  SkillMarketplaceSearchParams,
  SkillMarketplaceSearchResponse,
  SkillMarketplaceSource,
  SkillMarketplaceSourceId,
  SkillMarketplaceSkill,
} from './types';

export const DEFAULT_SKILL_MARKETPLACE_SOURCE_ID: SkillMarketplaceSourceId = 'skillhub';
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const SKILLHUB_API_URL = 'https://api.skillhub.cn/api/skills';
const CLAWHUB_PACKAGES_API_URL = 'https://wry-manatee-359.convex.site/api/v1/packages';
const CLAWHUB_SEARCH_API_URL = 'https://wry-manatee-359.convex.site/api/v1/packages/search';

export const SKILL_MARKETPLACE_SOURCES: SkillMarketplaceSource[] = [
  {
    id: 'skillhub',
    name: '腾讯 SkillHub',
    url: 'https://skillhub.cn/skills',
    detailBaseUrl: 'https://skillhub.cn/skills',
    description: '经过安全审核与多维度评估的中文 Skills 社区',
    recommended: true,
    defaultSort: 'downloads',
  },
  {
    id: 'clawhub',
    name: 'ClawHub',
    url: 'https://clawhub.ai/skills?sort=downloads',
    detailBaseUrl: 'https://clawhub.ai/skills',
    description: 'OpenClaw 官方技能与插件市场',
    recommended: false,
    defaultSort: 'downloads',
  },
];

export function getSkillMarketplaceSource(sourceId: SkillMarketplaceSourceId): SkillMarketplaceSource {
  return SKILL_MARKETPLACE_SOURCES.find((source) => source.id === sourceId) ?? SKILL_MARKETPLACE_SOURCES[0];
}

function normalizeLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.floor(limit)));
}

export function createSkillMarketplaceSearchUrl(params: SkillMarketplaceSearchParams): string {
  const source = getSkillMarketplaceSource(params.sourceId);
  const query = params.query?.trim() ?? '';
  const limit = normalizeLimit(params.limit);

  if (source.id === 'skillhub') {
    const url = new URL(SKILLHUB_API_URL);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', String(limit));
    url.searchParams.set('sortBy', params.sort ?? source.defaultSort);
    url.searchParams.set('order', 'desc');
    if (query) {
      url.searchParams.set('keyword', query);
    }
    return url.toString();
  }

  const url = new URL(query ? CLAWHUB_SEARCH_API_URL : CLAWHUB_PACKAGES_API_URL);
  if (query) {
    url.searchParams.set('q', query);
  }
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('family', 'skill');
  return url.toString();
}

export async function fetchSkillMarketplaceSkills(
  params: SkillMarketplaceSearchParams,
  fetcher: typeof fetch = fetch,
): Promise<SkillMarketplaceSkill[]> {
  const response = await fetcher(createSkillMarketplaceSearchUrl(params), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Marketplace API request failed: ${response.status}`);
  }

  const data = (await response.json()) as
    | SkillMarketplaceSearchResponse
    | {
        code?: number;
        message?: string;
        data?: {
          skills?: unknown[];
        };
      };

  if (params.sourceId === 'skillhub') {
    if (typeof data === 'object' && data !== null && 'code' in data && data.code !== 0) {
      throw new Error(typeof data.message === 'string' ? data.message : 'SkillHub API returned an error');
    }
    const skills = typeof data === 'object' && data !== null && 'data' in data ? data.data?.skills : data;
    return normalizeSkillMarketplaceSearchResponse(skills as SkillMarketplaceSearchResponse, params.sourceId);
  }

  return normalizeSkillMarketplaceSearchResponse(data as SkillMarketplaceSearchResponse, params.sourceId);
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return undefined;
}

function readSourceId(value: unknown, fallback: SkillMarketplaceSourceId): SkillMarketplaceSourceId {
  return value === 'clawhub' || value === 'skillhub' ? value : fallback;
}

function normalizeSkill(item: unknown, fallbackSourceId: SkillMarketplaceSourceId): SkillMarketplaceSkill | null {
  if (typeof item !== 'object' || item === null) return null;

  const record = item as Record<string, unknown>;
  const id = readString(record, ['id', 'slug', 'name', 'displayName', 'title']);
  const name = readString(record, ['name', 'displayName', 'title', 'slug', 'id']);
  if (!id || !name) return null;

  const sourceId =
    fallbackSourceId === 'skillhub'
      ? fallbackSourceId
      : readSourceId(record.sourceId ?? record.source, fallbackSourceId);
  const slug = readString(record, ['slug']);
  const detailUrl = readString(record, ['detailUrl', 'url']);

  return {
    id,
    slug,
    name,
    description: readString(record, ['description', 'summary', 'summaryZh', 'description_zh']),
    version: readString(record, ['version', 'latestVersion']),
    author: readString(record, ['author', 'publisher', 'owner', 'ownerName', 'ownerHandle']),
    category: readString(record, ['category', 'categoryName']),
    downloads: readNumber(record, ['downloads', 'downloadCount']),
    stars: readNumber(record, ['stars', 'starCount']),
    sourceId,
    sourceName: getSkillMarketplaceSource(sourceId).name,
    reviewed: readBoolean(record, ['reviewed', 'approved', 'securityReviewed']),
    safety: readString(record, ['safety', 'securityStatus', 'reviewStatus']),
    installSpec: readString(record, ['installSpec', 'package', 'spec', 'homepage']),
    detailUrl:
      detailUrl ??
      (slug ? `${getSkillMarketplaceSource(sourceId).detailBaseUrl}/${encodeURIComponent(slug)}` : undefined),
  };
}

export function normalizeSkillMarketplaceSearchResponse(
  response: SkillMarketplaceSearchResponse,
  fallbackSourceId: SkillMarketplaceSourceId = DEFAULT_SKILL_MARKETPLACE_SOURCE_ID,
): SkillMarketplaceSkill[] {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(response?.skills)
      ? response.skills
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response?.results)
          ? response.results
          : [];

  return list
    .map((item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        'package' in item &&
        typeof (item as Record<string, unknown>).package === 'object'
      ) {
        return normalizeSkill((item as Record<string, unknown>).package, fallbackSourceId);
      }
      return normalizeSkill(item, fallbackSourceId);
    })
    .filter((item): item is SkillMarketplaceSkill => item !== null);
}
