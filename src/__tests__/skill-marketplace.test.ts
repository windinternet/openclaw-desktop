import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SKILL_MARKETPLACE_SOURCE_ID,
  SKILL_MARKETPLACE_SOURCES,
  createSkillMarketplaceSearchUrl,
  normalizeSkillMarketplaceSearchResponse,
} from '../lib/skill-marketplace';

describe('skill marketplace sources', () => {
  it('uses Tencent SkillHub as the recommended default source', () => {
    expect(DEFAULT_SKILL_MARKETPLACE_SOURCE_ID).toBe('skillhub');
    expect(SKILL_MARKETPLACE_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skillhub',
          name: '腾讯 SkillHub',
          url: 'https://skillhub.cn/skills',
          recommended: true,
        }),
      ]),
    );
  });

  it('also exposes the official ClawHub source', () => {
    expect(SKILL_MARKETPLACE_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'clawhub',
          name: 'ClawHub',
          url: 'https://clawhub.ai/skills?sort=downloads',
        }),
      ]),
    );
  });

  it('builds SkillHub API URLs for default browse and keyword search', () => {
    expect(
      createSkillMarketplaceSearchUrl({
        sourceId: 'skillhub',
        query: '',
        limit: 20,
      }),
    ).toBe('https://api.skillhub.cn/api/skills?page=1&pageSize=20&sortBy=downloads&order=desc');

    expect(
      createSkillMarketplaceSearchUrl({
        sourceId: 'skillhub',
        query: 'code review',
        limit: 12,
      }),
    ).toBe('https://api.skillhub.cn/api/skills?page=1&pageSize=12&sortBy=downloads&order=desc&keyword=code+review');
  });

  it('builds ClawHub API URLs for default browse and keyword search', () => {
    expect(
      createSkillMarketplaceSearchUrl({
        sourceId: 'clawhub',
        limit: 20,
      }),
    ).toBe('https://wry-manatee-359.convex.site/api/v1/packages?limit=20&family=skill');

    expect(
      createSkillMarketplaceSearchUrl({
        sourceId: 'clawhub',
        query: 'code review',
        limit: 12,
      }),
    ).toBe('https://wry-manatee-359.convex.site/api/v1/packages/search?q=code+review&limit=12&family=skill');
  });
});

describe('normalizeSkillMarketplaceSearchResponse', () => {
  it('normalizes marketplace API results from supported response shapes', () => {
    const direct = normalizeSkillMarketplaceSearchResponse([{ id: 'a', name: 'Doc Writer', sourceId: 'skillhub' }]);
    const wrappedSkills = normalizeSkillMarketplaceSearchResponse(
      {
        skills: [{ slug: 'code-review', displayName: 'Code Review', source: 'clawhub' }],
      },
      'clawhub',
    );
    const wrappedItems = normalizeSkillMarketplaceSearchResponse({
      items: [{ slug: 'test-runner', title: 'Test Runner' }],
    });

    expect(direct).toEqual([expect.objectContaining({ id: 'a', name: 'Doc Writer', sourceId: 'skillhub' })]);
    expect(wrappedSkills).toEqual([
      expect.objectContaining({ id: 'code-review', name: 'Code Review', sourceId: 'clawhub' }),
    ]);
    expect(wrappedItems).toEqual([
      expect.objectContaining({ id: 'test-runner', name: 'Test Runner', sourceId: 'skillhub' }),
    ]);
  });

  it('keeps SkillHub marketplace identity even when upstream source is ClawHub', () => {
    const results = normalizeSkillMarketplaceSearchResponse(
      [
        {
          slug: 'self-improving-agent',
          name: 'Self-Improving Agent',
          source: 'clawhub',
          ownerName: 'pskoett',
          description_zh: '自我改进代理',
        },
      ],
      'skillhub',
    );

    expect(results).toEqual([
      expect.objectContaining({
        id: 'self-improving-agent',
        name: 'Self-Improving Agent',
        sourceId: 'skillhub',
        sourceName: '腾讯 SkillHub',
        author: 'pskoett',
        description: '自我改进代理',
      }),
    ]);
  });
});

describe('Extensions marketplace UI', () => {
  it('contains a marketplace tab, direct marketplace search, and Gateway-backed install actions', () => {
    const pageSource = readFileSync('src/pages/ExtensionsPage.tsx', 'utf8');
    const storeSource = readFileSync('src/lib/store.ts', 'utf8');

    expect(pageSource).toContain('itemKey="marketplace"');
    expect(pageSource).toContain("t('extensions.marketplace')");
    expect(pageSource).toContain('searchSkillMarketplace');
    expect(pageSource).toContain('installMarketplaceSkill');
    expect(pageSource).toContain('openMarketplaceSource');
    expect(pageSource).toContain("(section ?? activeTabKey) === 'marketplace'");
    expect(pageSource).toContain('marketplaceLoadedSourceId');
    expect(storeSource).toContain('fetchSkillMarketplaceSkills');
    expect(storeSource).not.toContain('skills.market.search');
    expect(storeSource).toContain('skills.market.install');
  });
});
