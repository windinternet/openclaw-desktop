import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAiActionApprovalWithGateway } from '../lib/ai-action-center';
import { loadAiActionRuns, upsertAiActionRun } from '../lib/ai-action-run-store';
import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import { artifactService } from '../lib/artifact-service';
import { applyKnowledgeRewriteApproval } from '../lib/repository-knowledge';
import { recordRepositoryAssetExecution } from '../lib/repository-outputs';
import { applyWorkbenchMatterPlanApproval } from '../lib/repository-workbench';
import type { ArtifactMeta } from '../lib/artifact-types';
import type { AiActionRun } from '../lib/types';

vi.mock('../lib/ai-action-center', () => ({
  resolveAiActionApprovalWithGateway: vi.fn(),
}));

vi.mock('../lib/ai-action-run-store', () => ({
  loadAiActionRuns: vi.fn(),
  recoverInterruptedAiActionRuns: vi.fn(),
  syncAiActionRunsWithGateway: vi.fn(),
  upsertAiActionRun: vi.fn(),
}));

vi.mock('../lib/agentic-repository-store', () => ({
  loadRepositoryBinding: vi.fn(),
}));

vi.mock('../lib/repository-workbench', () => ({
  applyWorkbenchMatterPlanApproval: vi.fn(),
}));

vi.mock('../lib/repository-knowledge', () => ({
  applyKnowledgeRewriteApproval: vi.fn(),
  formatKnowledgeRewriteWrittenPaths: (paths: string[]) => paths.join(', '),
}));

vi.mock('../lib/repository-outputs', () => ({
  buildArtifactRepositoryOutputUpdates: vi.fn(),
  mirrorArtifactToReadyRepositoryOutput: vi.fn(),
  recordRepositoryAssetExecution: vi.fn(),
}));

vi.mock('../lib/artifact-service', () => ({
  artifactService: {
    list: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../lib/gateway', () => ({
  createGatewayClient: vi.fn(),
}));

vi.mock('../lib/desktop-bridge', () => ({
  connectDesktopBridgeToGateway: vi.fn(),
  disconnectDesktopBridge: vi.fn(),
}));

vi.mock('../lib/local-persistence', () => ({
  loadAppSnapshot: vi.fn(async () => ({ settings: null, instances: [], currentInstanceId: null })),
  removePersistedInstance: vi.fn(),
  saveCurrentInstanceId: vi.fn(),
  saveInstances: vi.fn(),
}));

import { useStore } from '../lib/store';

const mockedResolveApproval = vi.mocked(resolveAiActionApprovalWithGateway);
const mockedLoadAiActionRuns = vi.mocked(loadAiActionRuns);
const mockedUpsertAiActionRun = vi.mocked(upsertAiActionRun);
const mockedLoadRepositoryBinding = vi.mocked(loadRepositoryBinding);
const mockedRecordRepositoryAssetExecution = vi.mocked(recordRepositoryAssetExecution);
const mockedArtifactService = vi.mocked(artifactService);
const mockedApplyWorkbenchMatterPlanApproval = vi.mocked(applyWorkbenchMatterPlanApproval);
const mockedApplyKnowledgeRewriteApproval = vi.mocked(applyKnowledgeRewriteApproval);

describe('Desktop card authorization approval handler', () => {
  const client = {
    getStatus: () => 'connected',
    request: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      currentInstanceId: 'inst-1',
      activeClient: client as never,
      instanceRuntimes: {},
      actionRunsVersion: 0,
    });
    mockedUpsertAiActionRun.mockResolvedValue([]);
    mockedArtifactService.list.mockResolvedValue([]);
    mockedArtifactService.update.mockResolvedValue(undefined);
  });

  it('resolves a pending ActionRun approval through the existing Action Center boundary', async () => {
    const run = createActionRun();
    const updated = {
      ...run,
      status: 'running' as const,
      approvals: run.approvals?.map((approval) => ({ ...approval, status: 'approved' as const })),
    };
    mockedLoadAiActionRuns.mockResolvedValue([run]);
    mockedResolveApproval.mockResolvedValue(updated);

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        actionRunId: 'run_1',
        approvalId: 'approval_1',
        decision: 'approved',
      }),
    ).resolves.toEqual({ run: updated });

    expect(mockedResolveApproval).toHaveBeenCalledWith(client, run, 'approval_1', 'approved');
    expect(mockedUpsertAiActionRun).toHaveBeenCalledWith('inst-1', updated);
    expect(useStore.getState().actionRunsVersion).toBe(1);
  });

  it('resolves card approvals by Gateway run id when the local ActionRun id is not on the card', async () => {
    const run = createActionRun({ gatewayRunId: 'gw-run-1' });
    const updated = {
      ...run,
      status: 'running' as const,
      approvals: run.approvals?.map((approval) => ({ ...approval, status: 'approved' as const })),
    };
    mockedLoadAiActionRuns.mockResolvedValue([run]);
    mockedResolveApproval.mockResolvedValue(updated);

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        actionRunId: 'gw-run-1',
        approvalId: 'approval_1',
        decision: 'approved',
      }),
    ).resolves.toEqual({ run: updated });

    expect(mockedResolveApproval).toHaveBeenCalledWith(client, run, 'approval_1', 'approved');
    expect(mockedUpsertAiActionRun).toHaveBeenCalledWith('inst-1', updated);
  });

  it('applies work matter plan writes after an approved card approval', async () => {
    const run = createActionRun({
      type: 'work_matter_plan',
      workItemPath: 'work/active/demo.md',
      approvals: [
        {
          id: 'approval_1',
          title: '写入计划',
          risk: 'medium',
          status: 'pending',
          requestedAt: 1,
          repositoryWrite: {
            path: 'plans/active/demo.md',
            content: '# Demo',
            workItemPath: 'work/active/demo.md',
          },
        },
      ],
    });
    const resolved = { ...run, status: 'running' as const };
    mockedLoadAiActionRuns.mockResolvedValue([run]);
    mockedResolveApproval.mockResolvedValue(resolved);
    mockedLoadRepositoryBinding.mockResolvedValue({ status: 'repo_ready', repoPath: '/repo' } as never);
    mockedApplyWorkbenchMatterPlanApproval.mockResolvedValue({
      planPath: 'plans/active/demo.md',
      workItemPath: 'work/active/demo.md',
    });

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        actionRunId: 'run_1',
        approvalId: 'approval_1',
        decision: 'approved',
      }),
    ).resolves.toEqual({
      run: expect.objectContaining({
        id: 'run_1',
        resultSummary: '已写入计划：plans/active/demo.md',
      }),
      repositoryResult: {
        kind: 'work-matter-plan',
        planPath: 'plans/active/demo.md',
      },
    });

    expect(mockedApplyWorkbenchMatterPlanApproval).toHaveBeenCalledWith(
      { status: 'repo_ready', repoPath: '/repo' },
      {
        actionRunId: 'run_1',
        workItemPath: 'work/active/demo.md',
        repositoryWrite: run.approvals?.[0].repositoryWrite,
      },
    );
    expect(mockedUpsertAiActionRun).toHaveBeenCalledTimes(2);
    expect(useStore.getState().actionRunsVersion).toBe(2);
  });

  it('marks knowledge rewrite approvals done after approved repository writes are applied', async () => {
    const run = createActionRun({
      type: 'knowledge_rewrite',
      workItemPath: 'work/active/demo.md',
      approvals: [
        {
          id: 'approval_1',
          title: '写入知识库',
          risk: 'medium',
          status: 'pending',
          requestedAt: 1,
          repositoryWrite: {
            path: 'wiki/topics/demo.md',
            content: '# Demo',
            writes: [
              { path: 'wiki/topics/demo.md', content: '# Demo' },
              { path: 'wiki/index.md', content: '# Index' },
              { path: 'wiki/log.md', content: '# Log' },
            ],
          },
        },
      ],
    });
    const resolved = {
      ...run,
      status: 'running' as const,
      approvals: run.approvals?.map((approval) => ({ ...approval, status: 'approved' as const })),
    };
    mockedLoadAiActionRuns.mockResolvedValue([run]);
    mockedResolveApproval.mockResolvedValue(resolved);
    mockedLoadRepositoryBinding.mockResolvedValue({ status: 'repo_ready', repoPath: '/repo' } as never);
    mockedApplyKnowledgeRewriteApproval.mockResolvedValue({
      writtenPaths: ['wiki/topics/demo.md', 'wiki/index.md', 'wiki/log.md'],
    });

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        actionRunId: 'run_1',
        approvalId: 'approval_1',
        decision: 'approved',
      }),
    ).resolves.toEqual({
      run: expect.objectContaining({
        id: 'run_1',
        status: 'done',
        resultSummary: '已写入知识库：wiki/topics/demo.md, wiki/index.md, wiki/log.md',
      }),
      repositoryResult: {
        kind: 'knowledge-rewrite',
        writtenPaths: ['wiki/topics/demo.md', 'wiki/index.md', 'wiki/log.md'],
      },
    });

    expect(mockedUpsertAiActionRun).toHaveBeenLastCalledWith(
      'inst-1',
      expect.objectContaining({
        id: 'run_1',
        status: 'done',
        resultSummary: '已写入知识库：wiki/topics/demo.md, wiki/index.md, wiki/log.md',
      }),
    );
    expect(useStore.getState().actionRunsVersion).toBe(2);
  });

  it('does not resolve an approval without explicit ActionRun and approval ids', async () => {
    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        decision: 'approved',
      }),
    ).resolves.toBeNull();

    expect(mockedResolveApproval).not.toHaveBeenCalled();
    expect(mockedUpsertAiActionRun).not.toHaveBeenCalled();
  });

  it('records repository asset approval decisions from explicit authorization cards', async () => {
    mockedLoadRepositoryBinding.mockResolvedValue({ status: 'repo_ready', repoPath: '/repo' } as never);
    mockedRecordRepositoryAssetExecution.mockResolvedValue({
      indexPath: 'outputs/assets/index.md',
      runPath: 'runs/assets/20260629-approval-check.md',
      runIndexPath: 'runs/assets/index.md',
      assetId: 'approval-check',
      assetPath: 'tools/approval-check.md',
      title: 'Approval Check',
      reuseKind: 'tool',
      status: 'approved',
      reviewSuggested: false,
      recordOnly: true,
      desktopExecutes: false,
      grantsPermission: false,
    });

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        decision: 'approved',
        repositoryAssetExecution: {
          repoPath: '/repo',
          assetId: 'approval-check',
          approvalTitle: '运行审批检查',
          approvalRisk: 'medium',
          approvalReason: '需要用户批准后交给外部 runner',
          runner: 'external',
          command: 'npm run approval-check',
          workItemPath: 'work/active/demo.md',
          sourceApprovalRunPath: 'runs/assets/20260629-010203-approval-check.md',
        },
      } as never),
    ).resolves.toEqual({
      repositoryResult: {
        kind: 'repository-asset-approval',
        runPath: 'runs/assets/20260629-approval-check.md',
        status: 'approved',
      },
    });

    expect(mockedRecordRepositoryAssetExecution).toHaveBeenCalledWith({
      binding: { status: 'repo_ready', repoPath: '/repo' },
      status: 'approved',
      assetId: 'approval-check',
      approvalTitle: '运行审批检查',
      approvalRisk: 'medium',
      approvalReason: '需要用户批准后交给外部 runner',
      runner: 'external',
      command: 'npm run approval-check',
      workItemPath: 'work/active/demo.md',
      sourceApprovalRunPath: 'runs/assets/20260629-010203-approval-check.md',
    });
    expect(mockedResolveApproval).not.toHaveBeenCalled();
    expect(mockedUpsertAiActionRun).not.toHaveBeenCalled();
  });

  it('records repository asset denial decisions without treating them as ActionRun approvals', async () => {
    mockedLoadRepositoryBinding.mockResolvedValue({ status: 'repo_ready', repoPath: '/repo' } as never);
    mockedRecordRepositoryAssetExecution.mockResolvedValue({
      indexPath: 'outputs/assets/index.md',
      runPath: 'runs/assets/20260629-denied-check.md',
      runIndexPath: 'runs/assets/index.md',
      assetId: 'denied-check',
      assetPath: 'tools/denied-check.md',
      title: 'Denied Check',
      reuseKind: 'script',
      status: 'denied',
      reviewSuggested: false,
      recordOnly: true,
      desktopExecutes: false,
      grantsPermission: false,
    });

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        decision: 'rejected',
        repositoryAssetExecution: {
          repoPath: '/repo',
          path: 'tools/denied-check.md',
          approvalTitle: '运行拒绝检查',
        },
      } as never),
    ).resolves.toEqual({
      repositoryResult: {
        kind: 'repository-asset-approval',
        runPath: 'runs/assets/20260629-denied-check.md',
        status: 'denied',
      },
    });

    expect(mockedRecordRepositoryAssetExecution).toHaveBeenCalledWith({
      binding: { status: 'repo_ready', repoPath: '/repo' },
      status: 'denied',
      path: 'tools/denied-check.md',
      approvalTitle: '运行拒绝检查',
    });
    expect(mockedResolveApproval).not.toHaveBeenCalled();
  });

  it('rejects absolute repository asset run paths as executable asset approval paths', async () => {
    mockedLoadRepositoryBinding.mockResolvedValue({ status: 'repo_ready', repoPath: '/repo' } as never);

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        decision: 'approved',
        repositoryAssetExecution: {
          repoPath: '/repo',
          path: '/runs/assets/20260629-010203-approval-check.md',
        },
      } as never),
    ).resolves.toBeNull();

    expect(mockedRecordRepositoryAssetExecution).not.toHaveBeenCalled();
    expect(mockedResolveApproval).not.toHaveBeenCalled();
  });

  it('records Artifact execution approval decisions without executing the runner', async () => {
    const artifact = createExecutableArtifact();
    useStore.setState({ artifacts: [artifact] });
    mockedArtifactService.list.mockResolvedValue([
      {
        ...artifact,
        executionEvents: [
          ...(artifact.executionEvents ?? []),
          {
            id: 'exec_decision',
            status: 'approved',
            artifactVersion: 2,
            requestedAt: 20,
            runner: 'artifactBridge.exec',
            command: 'npm run smoke',
          },
        ],
      },
    ]);

    await expect(
      useStore.getState().resolveDesktopCardAuthorizationApproval({
        decision: 'approved',
        artifactExecution: {
          artifactId: 'art_bridge_exec',
          eventId: 'exec_pending',
          approvalReason: '需要用户批准后交给外部 runner',
        },
      } as never),
    ).resolves.toEqual({
      repositoryResult: {
        kind: 'artifact-execution-approval',
        artifactId: 'art_bridge_exec',
        status: 'approved',
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_bridge_exec', {
      executionEvents: [
        expect.objectContaining({
          id: 'exec_pending',
          status: 'approval_required',
          runner: 'artifactBridge.exec',
          command: 'npm run smoke',
        }),
        expect.objectContaining({
          status: 'approved',
          runner: 'artifactBridge.exec',
          command: 'npm run smoke',
          approvalTitle: '运行 HTML 命令',
          approvalRisk: 'high',
          approvalReason: '需要用户批准后交给外部 runner',
          resultSummary:
            'User approved external runner handoff for Artifact execution; Desktop did not execute the command or grant permission.',
        }),
      ],
    });
    expect(mockedArtifactService.list).toHaveBeenCalled();
    expect(mockedResolveApproval).not.toHaveBeenCalled();
    expect(mockedRecordRepositoryAssetExecution).not.toHaveBeenCalled();
  });
});

function createActionRun(overrides: Partial<AiActionRun> = {}): AiActionRun {
  return {
    id: 'run_1',
    type: 'artifact_create',
    sourcePage: 'session-card',
    instanceId: 'inst-1',
    agentId: 'main',
    status: 'awaiting_approval',
    executionMode: 'isolated-session',
    input: 'Create artifact',
    gatewaySessionKey: 'agent:main:desktop-action:artifact-create:run_1',
    approvals: [
      {
        id: 'approval_1',
        title: '创建产物',
        risk: 'medium',
        status: 'pending',
        requestedAt: 1,
      },
    ],
    childSessionKeys: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createExecutableArtifact(): ArtifactMeta {
  return {
    id: 'art_bridge_exec',
    title: 'HTML 工具',
    icon: '📊',
    type: 'report',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 2,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    reuseKind: 'tool',
    executionEvents: [
      {
        id: 'exec_pending',
        status: 'approval_required',
        artifactVersion: 2,
        requestedAt: 10,
        runner: 'artifactBridge.exec',
        command: 'npm run smoke',
        approvalTitle: '运行 HTML 命令',
        approvalRisk: 'high',
        approvalReason: 'HTML 请求命令执行',
        resultSummary: 'Prepared artifactBridge.exec approval request; Desktop did not execute the command.',
      },
    ],
  };
}
