import { describe, expect, it } from 'vitest';
import {
  recordArtifactAuthDecision,
  recordArtifactBridgeCallResult,
  recordArtifactBridgeExecApprovalRequired,
} from '../lib/artifact-runtime-auth';
import type { ArtifactMeta } from '../lib/artifact-types';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: '交互报告',
    icon: '📊',
    type: 'report',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('artifact runtime auth records', () => {
  it('appends runtime authorization decisions to artifact metadata', () => {
    const updated = recordArtifactAuthDecision(createArtifact(), {
      id: 'auth_1',
      capability: 'readFile',
      detail: '/Users/deepin/report.csv',
      granted: true,
      level: 'artifact',
      requestedAt: 10,
      decidedAt: 20,
    });

    expect(updated.updatedAt).toBe(20);
    expect(updated.authEvents).toEqual([
      {
        id: 'auth_1',
        capability: 'readFile',
        detail: '/Users/deepin/report.csv',
        granted: true,
        level: 'artifact',
        requestedAt: 10,
        decidedAt: 20,
      },
    ]);
  });

  it('appends Desktop Bridge call results to artifact metadata', () => {
    const updated = recordArtifactBridgeCallResult(createArtifact(), {
      id: 'bridge_1',
      method: 'readFile',
      detail: '/Users/deepin/report.csv',
      status: 'succeeded',
      resultSummary: 'read 42 bytes',
      startedAt: 30,
      endedAt: 40,
    });

    expect(updated.updatedAt).toBe(40);
    expect(updated.bridgeEvents).toEqual([
      {
        id: 'bridge_1',
        method: 'readFile',
        detail: '/Users/deepin/report.csv',
        status: 'succeeded',
        resultSummary: 'read 42 bytes',
        startedAt: 30,
        endedAt: 40,
      },
    ]);
  });

  it('records artifactBridge.exec calls as approval-required execution intents', () => {
    const updated = recordArtifactBridgeExecApprovalRequired(createArtifact(), {
      id: 'exec_1',
      command: 'npm run deploy',
      requestedAt: 50,
      approvalTitle: 'Artifact Bridge command execution requested',
      approvalReason: 'HTML Artifact requested shell execution; Desktop only records the approval intent.',
    });

    expect(updated.updatedAt).toBe(50);
    expect(updated.executionEvents).toEqual([
      {
        id: 'exec_1',
        status: 'approval_required',
        artifactVersion: 1,
        requestedAt: 50,
        startedAt: undefined,
        endedAt: undefined,
        sourceId: undefined,
        sourceName: 'artifactBridge.exec',
        runner: 'artifactBridge.exec',
        command: 'npm run deploy',
        approvalTitle: 'Artifact Bridge command execution requested',
        approvalRisk: 'high',
        approvalReason: 'HTML Artifact requested shell execution; Desktop only records the approval intent.',
        outputArtifactId: undefined,
        repositoryOutputPath: undefined,
        resultSummary: 'Prepared artifactBridge.exec approval request; Desktop did not execute the command.',
        error: undefined,
      },
    ]);
  });
});
