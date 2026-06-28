import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dashboard tail action routing', () => {
  it('makes target pages consume Dashboard tail action context from the URL', () => {
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');
    const artifacts = readFileSync('src/pages/ArtifactsPage.tsx', 'utf8');
    const knowledge = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');

    expect(workbench).toContain('parseDashboardTailActionRoute(location.search)');
    expect(workbench).toContain('getWorkbenchTailActionTab(tailActionContext)');
    expect(workbench).toContain("t('workbench.tailActionContextTitle')");
    expect(workbench).toContain('context.workItemPath');

    expect(artifacts).toContain('parseDashboardTailActionRoute(location.search)');
    expect(artifacts).toContain("tailActionContext?.kind === 'output'");
    expect(artifacts).toContain('workItemPath={artifactTailActionContext?.workItemPath}');

    expect(knowledge).toContain('parseDashboardTailActionRoute(location.search)');
    expect(knowledge).toContain('getKnowledgeTailActionTab(tailActionContext)');
    expect(knowledge).toContain("t('knowledge.tailActionContextTitle')");
    expect(knowledge).toContain('tailActionContext.workItemPath');
  });
});
