import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ActionRun work item picker', () => {
  it('centralizes repository work item options for non-chat ActionRun entry points', () => {
    expect(existsSync('src/lib/workbench-work-items.ts')).toBe(true);

    const helper = readFileSync('src/lib/workbench-work-items.ts', 'utf8');
    const artifactDrawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const knowledgePanel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');
    const repositoryGate = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const teamsPage = readFileSync('src/pages/TeamsPage.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(helper).toContain('loadWorkbenchWorkItemOptions');
    expect(helper).toContain('createWorkbenchWorkItemOption');
    expect(helper).toContain('useWorkbenchWorkItemOptions');
    expect(helper).toContain('loadRepositoryBinding');
    expect(helper).toContain('loadWorkbenchSnapshot');
    expect(helper).toContain('readWorkbenchMarkdown');
    expect(helper).toContain('extractWorkbenchMatterId');

    expect(artifactDrawer).toContain('useWorkbenchWorkItemOptions');
    expect(artifactDrawer).toContain('newWorkItemTitle');
    expect(artifactDrawer).toContain('createWorkItem');
    expect(artifactDrawer).toContain("t('artifact.aiCreateNewWorkItemPlaceholder')");
    expect(artifactDrawer).toContain('selectedWorkItemId');
    expect(artifactDrawer).toContain('workItemId: resolvedWorkItemId');
    expect(artifactDrawer).toContain('workItemPath: resolvedWorkItemPath');

    expect(knowledgePanel).toContain('useWorkbenchWorkItemOptions');
    expect(knowledgePanel).toContain('selectedKnowledgeWorkItemPath');
    expect(knowledgePanel).toContain('selectedKnowledgeWorkItemId');
    expect(knowledgePanel).toContain("t('knowledge.rewriteWorkItemPlaceholder')");
    expect(knowledgePanel).toContain('workItemId: resolvedWorkItemId');
    expect(knowledgePanel).toContain('workItemPath: resolvedWorkItemPath');

    expect(teamsPage).toContain('useWorkbenchWorkItemOptions');
    expect(teamsPage).toContain('selectedTeamWorkItemPath');
    expect(teamsPage).toContain('selectedTeamWorkItemId');
    expect(teamsPage).toContain("t('teams.actionWorkItemPlaceholder')");
    expect(teamsPage).toContain('workItemId: resolvedWorkItemId');
    expect(teamsPage).toContain('workItemPath: resolvedWorkItemPath');

    expect(repositoryGate).toContain('useWorkbenchWorkItemOptions');
    expect(repositoryGate).toContain('selectedRepositoryWorkItemPath');
    expect(repositoryGate).toContain('selectedRepositoryWorkItemId');
    expect(repositoryGate).toContain("t('repositoryGate.mappingWorkItemPlaceholder')");
    expect(repositoryGate).toContain('workItemId: resolvedWorkItemId');
    expect(repositoryGate).toContain('workItemPath: resolvedWorkItemPath');

    expect(zh.knowledge.rewriteWorkItem).toBeTruthy();
    expect(zh.knowledge.rewriteWorkItemDesc).toBeTruthy();
    expect(zh.knowledge.rewriteWorkItemPlaceholder).toBeTruthy();
    expect(zh.artifact.aiCreateNewWorkItem).toBeTruthy();
    expect(zh.artifact.aiCreateNewWorkItemPlaceholder).toBeTruthy();
    expect(zh.artifact.aiCreateNewWorkItemSuccess).toBeTruthy();
    expect(en.knowledge.rewriteWorkItem).toBeTruthy();
    expect(en.knowledge.rewriteWorkItemDesc).toBeTruthy();
    expect(en.knowledge.rewriteWorkItemPlaceholder).toBeTruthy();
    expect(en.artifact.aiCreateNewWorkItem).toBeTruthy();
    expect(en.artifact.aiCreateNewWorkItemPlaceholder).toBeTruthy();
    expect(en.artifact.aiCreateNewWorkItemSuccess).toBeTruthy();
    expect(zh.teams.actionWorkItem).toBeTruthy();
    expect(zh.teams.actionWorkItemDesc).toBeTruthy();
    expect(zh.teams.actionWorkItemPlaceholder).toBeTruthy();
    expect(en.teams.actionWorkItem).toBeTruthy();
    expect(en.teams.actionWorkItemDesc).toBeTruthy();
    expect(en.teams.actionWorkItemPlaceholder).toBeTruthy();
    expect(zh.repositoryGate.mappingWorkItem).toBeTruthy();
    expect(zh.repositoryGate.mappingWorkItemDesc).toBeTruthy();
    expect(zh.repositoryGate.mappingWorkItemPlaceholder).toBeTruthy();
    expect(en.repositoryGate.mappingWorkItem).toBeTruthy();
    expect(en.repositoryGate.mappingWorkItemDesc).toBeTruthy();
    expect(en.repositoryGate.mappingWorkItemPlaceholder).toBeTruthy();
  });
});
