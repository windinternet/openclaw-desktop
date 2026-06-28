import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ActionRun work item picker', () => {
  it('centralizes repository work item options for non-chat ActionRun entry points', () => {
    expect(existsSync('src/lib/workbench-work-items.ts')).toBe(true);

    const helper = readFileSync('src/lib/workbench-work-items.ts', 'utf8');
    const artifactDrawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const knowledgePanel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(helper).toContain('loadWorkbenchWorkItemOptions');
    expect(helper).toContain('useWorkbenchWorkItemOptions');
    expect(helper).toContain('loadRepositoryBinding');
    expect(helper).toContain('loadWorkbenchSnapshot');
    expect(helper).toContain('readWorkbenchMarkdown');
    expect(helper).toContain('extractWorkbenchMatterId');

    expect(artifactDrawer).toContain('useWorkbenchWorkItemOptions');
    expect(artifactDrawer).toContain('selectedWorkItemId');
    expect(artifactDrawer).toContain('workItemId: resolvedWorkItemId');
    expect(artifactDrawer).toContain('workItemPath: resolvedWorkItemPath');

    expect(knowledgePanel).toContain('useWorkbenchWorkItemOptions');
    expect(knowledgePanel).toContain('selectedKnowledgeWorkItemPath');
    expect(knowledgePanel).toContain('selectedKnowledgeWorkItemId');
    expect(knowledgePanel).toContain("t('knowledge.rewriteWorkItemPlaceholder')");
    expect(knowledgePanel).toContain('workItemId: resolvedWorkItemId');
    expect(knowledgePanel).toContain('workItemPath: resolvedWorkItemPath');

    expect(zh.knowledge.rewriteWorkItem).toBeTruthy();
    expect(zh.knowledge.rewriteWorkItemDesc).toBeTruthy();
    expect(zh.knowledge.rewriteWorkItemPlaceholder).toBeTruthy();
    expect(en.knowledge.rewriteWorkItem).toBeTruthy();
    expect(en.knowledge.rewriteWorkItemDesc).toBeTruthy();
    expect(en.knowledge.rewriteWorkItemPlaceholder).toBeTruthy();
  });
});
