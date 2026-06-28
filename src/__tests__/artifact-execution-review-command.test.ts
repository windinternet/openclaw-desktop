import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_EXECUTION_REVIEW_WRITE_COMMAND,
  buildArtifactExecutionReviewWriteCommand,
  shouldOfferArtifactExecutionReviewCommand,
} from '../lib/artifact-execution-review-command';
import type { ArtifactMeta } from '../lib/artifact-types';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art-script',
    title: '同步脚本',
    icon: '⚙️',
    type: 'app',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'published',
    createdAt: 1,
    updatedAt: 2,
    reuseKind: 'script',
    command: 'node sync.js',
    ...overrides,
  };
}

describe('artifact execution review command', () => {
  it('offers review command only for terminal executable reusable artifacts', () => {
    expect(shouldOfferArtifactExecutionReviewCommand(createArtifact())).toBe(false);
    expect(
      shouldOfferArtifactExecutionReviewCommand(
        createArtifact({
          reuseKind: 'template',
          executionEvents: [
            {
              id: 'exec-1',
              status: 'succeeded',
              artifactVersion: 1,
              requestedAt: 10,
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferArtifactExecutionReviewCommand(
        createArtifact({
          executionEvents: [
            {
              id: 'exec-1',
              status: 'running',
              artifactVersion: 1,
              requestedAt: 10,
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferArtifactExecutionReviewCommand(
        createArtifact({
          executionEvents: [
            {
              id: 'exec-1',
              status: 'failed',
              artifactVersion: 1,
              requestedAt: 10,
              resultSummary: '脚本失败，缺少凭证。',
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('builds a copyable write command with repository path and hard boundaries', () => {
    const command = buildArtifactExecutionReviewWriteCommand(
      createArtifact({
        executionEvents: [
          {
            id: 'exec-1',
            status: 'succeeded',
            artifactVersion: 1,
            requestedAt: 10,
            runner: 'gateway-runner',
            command: 'node sync.js',
            outputArtifactId: 'art-output',
            repositoryOutputPath: 'outputs/apps/art-script.md',
            resultSummary: '同步完成。',
          },
        ],
      }),
      { repoPath: '/repo' },
    );

    expect(command).not.toBeNull();
    expect(command?.command).toBe(ARTIFACT_EXECUTION_REVIEW_WRITE_COMMAND);
    expect(command?.params.repoPath).toBe('/repo');
    expect(command?.params.artifactId).toBe('art-script');
    expect(command?.params.reviewSummary).toContain('同步完成。');
    expect(command?.params.reuseDecision).toBe('待确认。');
    expect(command?.params.nextActions).toContain('记录复用判断。');
    expect(command?.latestExecution?.status).toBe('succeeded');
    expect(command?.latestExecution?.outputArtifactId).toBe('art-output');
    expect(command?.boundary).toEqual({
      recordOnly: true,
      desktopExecutes: false,
      grantsPermission: false,
    });
  });

  it('keeps a repoPath placeholder when no ready repository binding is available', () => {
    const command = buildArtifactExecutionReviewWriteCommand(
      createArtifact({
        executionEvents: [
          {
            id: 'exec-1',
            status: 'cancelled',
            artifactVersion: 1,
            requestedAt: 10,
          },
        ],
      }),
    );

    expect(command?.params.repoPath).toBe('<绑定仓库绝对路径>');
  });
});
