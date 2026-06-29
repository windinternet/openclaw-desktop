import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_EXECUTION_PREPARE_COMMAND,
  ARTIFACT_EXECUTION_RECORD_COMMAND,
  buildArtifactExecutionBoundary,
} from '../lib/artifact-execution-boundary';
import type { ArtifactMeta } from '../lib/artifact-types';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_asset',
    title: '部署脚本',
    icon: '🧰',
    type: 'file',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 3,
    status: 'published',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('artifact execution boundary', () => {
  it('does not expose execution boundary for non-executable reusable artifacts', () => {
    const boundary = buildArtifactExecutionBoundary(
      createArtifact({
        reuseKind: 'template',
        executionEvents: [
          {
            id: 'exec_template',
            status: 'succeeded',
            artifactVersion: 3,
            requestedAt: 10,
            resultSummary: '模板被复用。',
          },
        ],
      }),
    );

    expect(boundary).toBeNull();
  });

  it('exposes approval and record-only commands for executable reusable artifacts', () => {
    const boundary = buildArtifactExecutionBoundary(createArtifact({ reuseKind: 'script' }));

    expect(boundary).toMatchObject({
      reuseKind: 'script',
      executable: true,
      requiresApprovalBeforeRun: true,
      executionEventCount: 0,
      prepareCommand: ARTIFACT_EXECUTION_PREPARE_COMMAND,
      recordCommand: ARTIFACT_EXECUTION_RECORD_COMMAND,
      boundary: {
        recordOnly: true,
        desktopExecutes: false,
        grantsPermission: false,
      },
    });
    expect(boundary?.latestExecution).toBeUndefined();
  });

  it('summarizes the latest executable approval and execution facts', () => {
    const boundary = buildArtifactExecutionBoundary(
      createArtifact({
        reuseKind: 'workflow',
        executionEvents: [
          {
            id: 'exec_old',
            status: 'running',
            artifactVersion: 2,
            requestedAt: 10,
            runner: 'local-runner',
            command: 'node old.js',
          },
          {
            id: 'exec_latest',
            status: 'approval_required',
            artifactVersion: 3,
            requestedAt: 20,
            approvalTitle: '执行数据整理工作流',
            approvalRisk: 'medium',
            approvalReason: '会读取用户选择的资料并生成新产物。',
            runner: 'gateway-runner',
            command: 'node organize.js',
            resultSummary: '等待用户审批。',
          },
        ],
      }),
    );

    expect(boundary).toMatchObject({
      reuseKind: 'workflow',
      executionEventCount: 2,
      latestExecution: {
        id: 'exec_latest',
        status: 'approval_required',
        approvalTitle: '执行数据整理工作流',
        approvalRisk: 'medium',
        approvalReason: '会读取用户选择的资料并生成新产物。',
        runner: 'gateway-runner',
        command: 'node organize.js',
        resultSummary: '等待用户审批。',
      },
    });
  });
});
