import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildDashboardTailActionTarget,
  isRepositoryAssetRunPathLike,
  isSafeRepositoryAssetRunPath,
  parseDashboardTailActionRoute,
} from '../lib/dashboard-tail-action-routing';

describe('dashboard tail action routing', () => {
  it('round-trips repository asset run context through tail action URLs', () => {
    const target = buildDashboardTailActionTarget('/artifacts', {
      kind: 'output',
      id: 'work/active/release.md:tail-action:1',
      workItemPath: 'work/active/release.md',
      assetRunPath: 'runs/assets/20260629-010203-tools-release-check-sh.md',
    });

    expect(target).toBe(
      '/artifacts?tailAction=output&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A1&workItemPath=work%2Factive%2Frelease.md&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(parseDashboardTailActionRoute(target.slice('/artifacts'.length))).toEqual({
      kind: 'output',
      id: 'work/active/release.md:tail-action:1',
      workItemPath: 'work/active/release.md',
      assetRunPath: 'runs/assets/20260629-010203-tools-release-check-sh.md',
    });
  });

  it('drops unsafe tail action route paths from URL context', () => {
    expect(
      parseDashboardTailActionRoute(
        '?tailAction=output&tailActionId=unsafe&workItemPath=../secret.md&assetRunPath=runs/assets/../secret.md',
      ),
    ).toEqual({
      kind: 'output',
      id: 'unsafe',
      workItemPath: undefined,
      assetRunPath: undefined,
    });

    expect(
      parseDashboardTailActionRoute(
        '?tailAction=knowledge&workItemPath=plans/active/release.md&assetRunPath=/runs/assets/release.md',
      ),
    ).toEqual({
      kind: 'knowledge',
      id: undefined,
      workItemPath: undefined,
      assetRunPath: undefined,
    });
  });

  it('shares safe repository asset run path parsing with Workbench asset preview routes', () => {
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');

    expect(isSafeRepositoryAssetRunPath('runs/assets/20260629-010203-release.md')).toBe(true);
    expect(isSafeRepositoryAssetRunPath('runs/assets/../secret.md')).toBe(false);
    expect(isSafeRepositoryAssetRunPath('/runs/assets/20260629-010203-release.md')).toBe(false);
    expect(workbench).toContain('isSafeRepositoryAssetRunPath(assetRunPath ?? undefined)');
  });

  it('shares repository asset run path classification with Desktop card approval routing', () => {
    const sessionContent = readFileSync('src/lib/session-content.ts', 'utf8');

    expect(isRepositoryAssetRunPathLike('runs/assets/20260629-010203-release.md')).toBe(true);
    expect(isRepositoryAssetRunPathLike('runs/assets/../secret.md')).toBe(true);
    expect(isRepositoryAssetRunPathLike('/runs/assets/20260629-010203-release.md')).toBe(true);
    expect(isRepositoryAssetRunPathLike('tools/release-check.sh')).toBe(false);
    expect(sessionContent).toContain('getDesktopCardRepositoryAssetPath');
    expect(sessionContent).toContain('!isRepositoryAssetRunPathLike(text)');
    expect(sessionContent).not.toContain("assetPath.startsWith('runs/assets/')");
  });

  it('makes target pages consume Dashboard tail action context from the URL', () => {
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');
    const workbenchPanel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const artifacts = readFileSync('src/pages/ArtifactsPage.tsx', 'utf8');
    const knowledge = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');
    const knowledgePanel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');

    expect(workbench).toContain('parseDashboardTailActionRoute(location.search)');
    expect(workbench).toContain('getWorkbenchTailActionTab(tailActionContext)');
    expect(workbench).toContain("t('workbench.tailActionContextTitle')");
    expect(workbench).toContain('context.workItemPath');
    expect(workbench).toContain('assetRunPath');
    expect(workbench).toContain('tailActionContext={tailActionContext}');
    expect(workbench).toContain('assetRunPath={assetRunPath}');

    expect(workbenchPanel).toContain("tailActionContext?.kind === 'status'");
    expect(workbenchPanel).toContain('updateWorkbenchMatterStatusFromTailAction');
    expect(workbenchPanel).toContain('archiveCompletedWorkbenchMatter');
    expect(workbenchPanel).toContain("t('workbench.statusTailActionTitle')");
    expect(workbenchPanel).toContain("t('workbench.updateMatterStatus')");
    expect(workbenchPanel).toContain("t('workbench.archiveCompletedMatter')");
    expect(workbenchPanel).toContain("tailActionContext?.kind === 'review'");
    expect(workbenchPanel).toContain("t('workbench.reviewTailActionTitle')");
    expect(workbenchPanel).toContain("t('workbench.reviewTailActionWriteCommand')");
    expect(workbenchPanel).toContain('writeWorkbenchReviewDraft');
    expect(workbenchPanel).toContain('confirmWorkbenchReviewDraft');
    expect(workbenchPanel).toContain("t('workbench.createReviewDraft')");
    expect(workbenchPanel).toContain("t('workbench.reviewDraftCreated')");
    expect(workbenchPanel).toContain('workbench.confirmReviewDraft');
    expect(workbenchPanel).toContain('workbench.reviewDraftConfirmed');
    expect(workbenchPanel).toContain('workbench.confirmReviewSourceDraft');
    expect(workbenchPanel).toContain('workbench.reviewSourceDraftConfirmed');
    expect(workbenchPanel).toContain('desktop.artifacts.execution.review.write');
    expect(workbenchPanel).toContain('reviews/weekly/');
    expect(workbenchPanel).toContain('openedInitialAssetRunPath');
    expect(workbenchPanel).toContain('readWorkbenchMarkdown(binding, assetRunPath)');
    expect(workbenchPanel).toContain('reviewTailActionCanConfirm');
    expect(workbenchPanel).toContain("reviewTailActionContext.id.includes(':tail-action:')");
    expect(workbenchPanel).toContain('reviewSourceExecutionCanConfirm');
    expect(workbenchPanel).toContain("reviewTailActionContext.id.startsWith('action-run-review:')");
    expect(workbenchPanel).toContain('reviewTailActionRunId');
    expect(workbenchPanel).toContain('action-run-review:');
    expect(workbenchPanel).toContain("t('workbench.reviewTailActionRunSource')");
    expect(workbenchPanel).toContain('writeWorkbenchAssetRunReviewDraft');
    expect(workbenchPanel).toContain('confirmWorkbenchAssetRunReviewDraft');
    expect(workbenchPanel).toContain("t('workbench.assetRunReviewTitle')");
    expect(workbenchPanel).toContain('desktop.repository.assets.execution.review.write');
    expect(workbenchPanel).toContain("t('workbench.confirmAssetRunReviewDraft')");

    expect(artifacts).toContain('parseDashboardTailActionRoute(location.search)');
    expect(artifacts).toContain("tailActionContext?.kind === 'output'");
    expect(artifacts).toContain('!embedded && artifactTailActionContext ?');
    expect(artifacts).toContain('workItemPath={artifactTailActionContext?.workItemPath}');
    expect(artifacts).toContain('artifactTailActionContext.assetRunPath');

    expect(knowledge).toContain('parseDashboardTailActionRoute(location.search)');
    expect(knowledge).toContain('getKnowledgeTailActionTab(tailActionContext)');
    expect(knowledge).toContain("t('knowledge.tailActionContextTitle')");
    expect(knowledge).toContain('tailActionContext.workItemPath');
    expect(knowledge).toContain('tailActionContext={tailActionContext}');

    expect(knowledgePanel).toContain("tailActionContext?.kind === 'knowledge'");
    expect(knowledgePanel).toContain('buildKnowledgeTailActionRewriteInstruction');
    expect(knowledgePanel).toContain('confirmWorkbenchKnowledgeTailAction');
    expect(knowledgePanel).toContain("t('knowledge.startTailActionRewrite')");
    expect(knowledgePanel).toContain("t('knowledge.confirmTailAction')");
    expect(knowledgePanel).toContain('knowledgeTailActionCanRewrite');
    expect(knowledgePanel).toContain('disabled={!knowledgeTailActionCanRewrite}');
    expect(knowledgePanel).toContain('workItemPath: tailActionContext.workItemPath');
    expect(knowledgePanel).toContain('assetRunPath: tailActionContext.assetRunPath');
    expect(knowledgePanel).toContain('tailActionId: tailActionContext.id');
    expect(knowledgePanel).toContain('knowledgeTailActionContext.assetRunPath');
    expect(knowledgePanel).toContain('knowledgeTailActionCanConfirm');
    expect(knowledgePanel).toContain("knowledgeTailActionContext.id.includes(':tail-action:')");
    expect(knowledgePanel).toContain('knowledgeTailActionRunId');
    expect(knowledgePanel).toContain('action-run-knowledge:');
    expect(knowledgePanel).toContain('findAiActionRunByLocalOrGatewayId');
    expect(knowledgePanel).toContain('loadAiActionRuns');
    expect(knowledgePanel).toContain('readWorkbenchMarkdown(binding, knowledgeTailActionContext.assetRunPath)');
    expect(knowledgePanel).toContain('knowledgeTailActionAssetRunMarkdown');
    expect(knowledgePanel).toContain('sourceAssetRunMarkdown: knowledgeTailActionAssetRunMarkdown ?? undefined');
    expect(knowledgePanel).toContain('sourceRunResultSummary: knowledgeTailActionRun?.resultSummary');
    expect(knowledgePanel).toContain('sourceRunAssistantResponse: knowledgeTailActionRun?.lastAssistantResponse');
  });
});
