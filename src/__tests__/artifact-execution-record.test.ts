import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { recordArtifactExecutionEvent } from '../lib/artifact-execution-record';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_script',
    title: '部署脚本',
    icon: '📎',
    type: 'file',
    source: { type: 'action_run', id: 'run_create' },
    tags: ['deploy'],
    currentVersion: 3,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    reuseKind: 'script',
    command: 'npm run deploy',
    ...overrides,
  };
}

describe('artifact execution records', () => {
  it('records executable artifact run facts without executing the artifact', () => {
    const updated = recordArtifactExecutionEvent(createArtifact(), {
      id: 'exec_1',
      status: 'succeeded',
      requestedAt: 10,
      startedAt: 12,
      endedAt: 30,
      sourceId: 'run_use',
      sourceName: '部署生产',
      runner: 'Gateway Agent',
      command: 'npm run deploy -- --dry-run',
      approvalTitle: '运行部署脚本',
      approvalRisk: 'high',
      approvalReason: '会调用本地命令，需要用户审批',
      outputArtifactId: 'art_output',
      repositoryOutputPath: 'outputs/runs/exec_1.md',
      resultSummary: '生成 3 个发布命令',
    });

    expect(updated.updatedAt).toBe(30);
    expect(updated.executionEvents).toEqual([
      {
        id: 'exec_1',
        status: 'succeeded',
        artifactVersion: 3,
        requestedAt: 10,
        startedAt: 12,
        endedAt: 30,
        sourceId: 'run_use',
        sourceName: '部署生产',
        runner: 'Gateway Agent',
        command: 'npm run deploy -- --dry-run',
        approvalTitle: '运行部署脚本',
        approvalRisk: 'high',
        approvalReason: '会调用本地命令，需要用户审批',
        outputArtifactId: 'art_output',
        repositoryOutputPath: 'outputs/runs/exec_1.md',
        resultSummary: '生成 3 个发布命令',
      },
    ]);
  });
});
