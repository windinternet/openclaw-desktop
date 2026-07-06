import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ActionRun work item picker', () => {
  it('keeps production UI ActionRun entry points on the shared launch protocol', () => {
    const uiFiles = [
      'src/components/ArtifactAICreateDrawer.tsx',
      'src/components/KnowledgeRepositoryPanel.tsx',
      'src/components/RepositoryGate.tsx',
      'src/components/WorkbenchRepositoryPanel.tsx',
      'src/pages/TeamsPage.tsx',
      'src/pages/TasksPage.tsx',
    ];

    for (const filePath of uiFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, filePath).toContain('createAiActionRunWithWorkItemAssignment');
      expect(source, filePath).not.toContain('createAiActionRun({');
    }

    const pagesAndComponents = [
      ...uiFiles,
      'src/pages/ActionCenterPage.tsx',
      'src/pages/SessionChatPage.tsx',
      'src/pages/DashboardPage.tsx',
      'src/pages/NewSessionPage.tsx',
    ];
    const directCreateCallers = pagesAndComponents.filter((filePath) =>
      readFileSync(filePath, 'utf8').includes('createAiActionRun({'),
    );

    expect(directCreateCallers).toEqual([]);
    expect(readFileSync('docs/PLANS.md', 'utf8')).toContain('生产 UI ActionRun 发起入口已纳入共享协议护栏');
    expect(readFileSync('docs/design-docs/product-goal-roadmap.md', 'utf8')).toContain(
      '生产 UI ActionRun 发起入口已纳入共享协议护栏',
    );
    expect(readFileSync('src/lib/desktop-self-knowledge.ts', 'utf8')).toContain(
      'Production UI ActionRun launch entry points are guarded by static coverage',
    );
    expect(readFileSync('docs/references/product-goal-conversation-2026-06-28.md', 'utf8')).toContain(
      'Desktop 生产 UI ActionRun 发起协议护栏第一片',
    );
    for (const documentation of [
      readFileSync('docs/PLANS.md', 'utf8'),
      readFileSync('docs/design-docs/product-goal-roadmap.md', 'utf8'),
    ]) {
      expect(documentation).not.toContain('后续仍需推进真正覆盖未来入口的全局 ActionRun 发起协议');
    }
  });

  it('centralizes repository work item options for non-chat ActionRun entry points', () => {
    const pickerPath = 'src/components/ActionRunWorkItemPicker.tsx';

    expect(existsSync('src/lib/workbench-work-items.ts')).toBe(true);
    expect(existsSync(pickerPath)).toBe(true);

    const helper = readFileSync('src/lib/workbench-work-items.ts', 'utf8');
    const picker = existsSync(pickerPath) ? readFileSync(pickerPath, 'utf8') : '';
    const artifactDrawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const knowledgePanel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');
    const repositoryGate = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const teamsPage = readFileSync('src/pages/TeamsPage.tsx', 'utf8');
    const tasksPage = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const actionCenterPage = readFileSync('src/pages/ActionCenterPage.tsx', 'utf8');
    const libIndex = readFileSync('src/lib/index.ts', 'utf8');
    const plans = readFileSync('docs/PLANS.md', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(helper).toContain('loadWorkbenchWorkItemOptions');
    expect(helper).toContain('createWorkbenchWorkItemOption');
    expect(helper).toContain('useWorkbenchWorkItemOptions');
    expect(helper).toContain('loadRepositoryBinding');
    expect(helper).toContain('loadWorkbenchSnapshot');
    expect(helper).toContain('readWorkbenchMarkdown');
    expect(helper).toContain('extractWorkbenchMatterId');

    expect(picker).toContain('export function ActionRunWorkItemPicker');
    expect(picker).toContain('WorkbenchWorkItemOption');
    expect(picker).toContain('createWorkItem');
    expect(picker).toContain('selectedPath');
    expect(picker).toContain('const created = await createWorkItem(trimmedTitle)');
    expect(picker).toContain('onSelectedPathChange(created.path)');
    expect(picker).toContain('Toast.success');
    expect(picker).toContain('IconPlus');
    expect(picker).toContain('Select');
    expect(picker).toContain('Input');

    expect(artifactDrawer).toContain('useWorkbenchWorkItemOptions');
    expect(artifactDrawer).toContain('ActionRunWorkItemPicker');
    expect(artifactDrawer).toContain('createAiActionRunWithWorkItemAssignment');
    expect(artifactDrawer).not.toContain('newWorkItemTitle');
    expect(artifactDrawer).toContain('createWorkItem');
    expect(artifactDrawer).toContain("t('artifact.aiCreateNewWorkItemPlaceholder')");
    expect(artifactDrawer).toContain('selectedWorkItemId');
    expect(artifactDrawer).toContain('selectedWorkItem');
    expect(artifactDrawer).not.toContain('const { workItemId: resolvedWorkItemId');

    expect(knowledgePanel).toContain('useWorkbenchWorkItemOptions');
    expect(knowledgePanel).toContain('ActionRunWorkItemPicker');
    expect(knowledgePanel).toContain('createAiActionRunWithWorkItemAssignment');
    expect(knowledgePanel).not.toContain('newKnowledgeWorkItemTitle');
    expect(knowledgePanel).not.toContain('handleCreateKnowledgeWorkItem');
    expect(knowledgePanel).toContain('selectedKnowledgeWorkItemPath');
    expect(knowledgePanel).toContain('selectedKnowledgeWorkItemId');
    expect(knowledgePanel).toContain("t('knowledge.rewriteWorkItemPlaceholder')");
    expect(knowledgePanel).toContain("t('knowledge.rewriteNewWorkItemPlaceholder')");
    expect(knowledgePanel).toContain('selectedWorkItem: selectedKnowledgeWorkItem');
    expect(knowledgePanel).not.toContain('const { workItemId: resolvedWorkItemId');

    expect(teamsPage).toContain('useWorkbenchWorkItemOptions');
    expect(teamsPage).toContain('ActionRunWorkItemPicker');
    expect(teamsPage).toContain('createAiActionRunWithWorkItemAssignment');
    expect(teamsPage).not.toContain('newTeamWorkItemTitle');
    expect(teamsPage).not.toContain('handleCreateTeamWorkItem');
    expect(teamsPage).toContain('selectedTeamWorkItemPath');
    expect(teamsPage).toContain('selectedTeamWorkItemId');
    expect(teamsPage).toContain("t('teams.actionWorkItemPlaceholder')");
    expect(teamsPage).toContain("t('teams.actionNewWorkItemPlaceholder')");
    expect(teamsPage).toContain('selectedWorkItem: selectedTeamWorkItem');
    expect(teamsPage).not.toContain('const { workItemId: resolvedWorkItemId');

    expect(repositoryGate).toContain('useWorkbenchWorkItemOptions');
    expect(repositoryGate).toContain('ActionRunWorkItemPicker');
    expect(repositoryGate).toContain('createAiActionRunWithWorkItemAssignment');
    expect(repositoryGate).not.toContain('newRepositoryWorkItemTitle');
    expect(repositoryGate).not.toContain('handleCreateRepositoryWorkItem');
    expect(repositoryGate).toContain('selectedRepositoryWorkItemPath');
    expect(repositoryGate).toContain('selectedRepositoryWorkItemId');
    expect(repositoryGate).toContain("t('repositoryGate.mappingWorkItemPlaceholder')");
    expect(repositoryGate).toContain("t('repositoryGate.mappingNewWorkItemPlaceholder')");
    expect(repositoryGate).toContain('selectedWorkItem: selectedRepositoryWorkItem');
    expect(repositoryGate).not.toContain('const { workItemId: resolvedWorkItemId');

    expect(tasksPage).toContain('useWorkbenchWorkItemOptions');
    expect(tasksPage).toContain('ActionRunWorkItemPicker');
    expect(tasksPage).toContain('createAiActionRunWithWorkItemAssignment');
    expect(tasksPage).toContain('selectedTaskWorkItemPath');
    expect(tasksPage).toContain('selectedTaskWorkItemId');
    expect(tasksPage).toContain("t('tasks.actionWorkItemPlaceholder')");
    expect(tasksPage).toContain("t('tasks.actionNewWorkItemPlaceholder')");
    expect(tasksPage).toContain('selectedWorkItem: selectedTaskWorkItem');
    expect(tasksPage).not.toContain('const { workItemId: resolvedWorkItemId');

    expect(libIndex).toContain('createAiActionRunWithWorkItemAssignment');
    expect(libIndex).not.toContain('\n  createAiActionRun,\n');

    expect(actionCenterPage).toContain('useWorkbenchWorkItemOptions');
    expect(actionCenterPage).toContain('ActionRunWorkItemPicker');
    expect(actionCenterPage).toContain('assignAiActionRunToWorkItem');
    expect(actionCenterPage).toContain('selectedAssignmentPath');
    expect(actionCenterPage).toContain('createWorkItem');
    expect(plans).toContain('Artifacts、Knowledge、Teams、RepositoryGate、Tasks、ActionCenter 六个入口');
    expect(plans).toContain('ActionCenter 未归属运行补归属');
    expect(plans).toContain('ActionRun 共享发起入口第一片');
    expect(plans).toContain('createAiActionRunWithWorkItemAssignment()');
    expect(plans).not.toContain('当前完成的是六个现有入口的共享产品部件和第一片归属解析 helper');

    expect(zh.knowledge.rewriteWorkItem).toBeTruthy();
    expect(zh.knowledge.rewriteWorkItemDesc).toBeTruthy();
    expect(zh.knowledge.rewriteWorkItemPlaceholder).toBeTruthy();
    expect(zh.knowledge.rewriteNewWorkItem).toBeTruthy();
    expect(zh.knowledge.rewriteNewWorkItemPlaceholder).toBeTruthy();
    expect(zh.knowledge.rewriteNewWorkItemSuccess).toBeTruthy();
    expect(zh.artifact.aiCreateNewWorkItem).toBeTruthy();
    expect(zh.artifact.aiCreateNewWorkItemPlaceholder).toBeTruthy();
    expect(zh.artifact.aiCreateNewWorkItemSuccess).toBeTruthy();
    expect(en.knowledge.rewriteWorkItem).toBeTruthy();
    expect(en.knowledge.rewriteWorkItemDesc).toBeTruthy();
    expect(en.knowledge.rewriteWorkItemPlaceholder).toBeTruthy();
    expect(en.knowledge.rewriteNewWorkItem).toBeTruthy();
    expect(en.knowledge.rewriteNewWorkItemPlaceholder).toBeTruthy();
    expect(en.knowledge.rewriteNewWorkItemSuccess).toBeTruthy();
    expect(en.artifact.aiCreateNewWorkItem).toBeTruthy();
    expect(en.artifact.aiCreateNewWorkItemPlaceholder).toBeTruthy();
    expect(en.artifact.aiCreateNewWorkItemSuccess).toBeTruthy();
    expect(zh.teams.actionWorkItem).toBeTruthy();
    expect(zh.teams.actionWorkItemDesc).toBeTruthy();
    expect(zh.teams.actionWorkItemPlaceholder).toBeTruthy();
    expect(zh.teams.actionNewWorkItem).toBeTruthy();
    expect(zh.teams.actionNewWorkItemPlaceholder).toBeTruthy();
    expect(zh.teams.actionNewWorkItemSuccess).toBeTruthy();
    expect(en.teams.actionWorkItem).toBeTruthy();
    expect(en.teams.actionWorkItemDesc).toBeTruthy();
    expect(en.teams.actionWorkItemPlaceholder).toBeTruthy();
    expect(en.teams.actionNewWorkItem).toBeTruthy();
    expect(en.teams.actionNewWorkItemPlaceholder).toBeTruthy();
    expect(en.teams.actionNewWorkItemSuccess).toBeTruthy();
    expect(zh.repositoryGate.mappingWorkItem).toBeTruthy();
    expect(zh.repositoryGate.mappingWorkItemDesc).toBeTruthy();
    expect(zh.repositoryGate.mappingWorkItemPlaceholder).toBeTruthy();
    expect(zh.repositoryGate.mappingNewWorkItem).toBeTruthy();
    expect(zh.repositoryGate.mappingNewWorkItemPlaceholder).toBeTruthy();
    expect(zh.repositoryGate.mappingNewWorkItemSuccess).toBeTruthy();
    expect(en.repositoryGate.mappingWorkItem).toBeTruthy();
    expect(en.repositoryGate.mappingWorkItemDesc).toBeTruthy();
    expect(en.repositoryGate.mappingWorkItemPlaceholder).toBeTruthy();
    expect(en.repositoryGate.mappingNewWorkItem).toBeTruthy();
    expect(en.repositoryGate.mappingNewWorkItemPlaceholder).toBeTruthy();
    expect(en.repositoryGate.mappingNewWorkItemSuccess).toBeTruthy();
    expect(zh.tasks.actionWorkItem).toBeTruthy();
    expect(zh.tasks.actionWorkItemDesc).toBeTruthy();
    expect(zh.tasks.actionWorkItemPlaceholder).toBeTruthy();
    expect(zh.tasks.actionNewWorkItem).toBeTruthy();
    expect(zh.tasks.actionNewWorkItemPlaceholder).toBeTruthy();
    expect(zh.tasks.actionNewWorkItemSuccess).toBeTruthy();
    expect(en.tasks.actionWorkItem).toBeTruthy();
    expect(en.tasks.actionWorkItemDesc).toBeTruthy();
    expect(en.tasks.actionWorkItemPlaceholder).toBeTruthy();
    expect(en.tasks.actionNewWorkItem).toBeTruthy();
    expect(en.tasks.actionNewWorkItemPlaceholder).toBeTruthy();
    expect(en.tasks.actionNewWorkItemSuccess).toBeTruthy();
  });
});
