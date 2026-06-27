import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';
import { mirrorArtifactToReadyRepositoryOutput } from '../lib/repository-outputs';

vi.mock('../lib/artifact-service', () => ({
  artifactService: {
    generate: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock('../lib/artifact-persistence', () => ({
  artifactPersistence: {
    loadHtml: vi.fn(),
  },
}));

vi.mock('../lib/repository-outputs', () => ({
  buildArtifactRepositoryOutputUpdates: (output: { outputPath: string; previewPath?: string }) => ({
    repositoryOutputPath: output.outputPath,
    repositoryPreviewPath: output.previewPath,
  }),
  mirrorArtifactToReadyRepositoryOutput: vi.fn(),
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

const mockedArtifactService = vi.mocked(artifactService);
const mockedArtifactPersistence = vi.mocked(artifactPersistence);
const mockedMirrorArtifactToReadyRepositoryOutput = vi.mocked(mirrorArtifactToReadyRepositoryOutput);

describe('artifact repository mirroring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      currentInstanceId: 'inst-1',
      instanceRuntimes: {},
      artifacts: [],
    });
    mockedArtifactService.list.mockResolvedValue([]);
    mockedArtifactPersistence.loadHtml.mockResolvedValue('<html>ok</html>');
  });

  it('mirrors UI-created artifacts into the ready repository for the current instance', async () => {
    const artifact = createArtifact();
    mockedArtifactService.generate.mockResolvedValue(artifact);
    mockedMirrorArtifactToReadyRepositoryOutput.mockResolvedValue({
      outputId: 'art_1',
      outputPath: 'outputs/reports/art_1.md',
      previewPath: 'outputs/html/art_1.html',
    });

    await expect(
      useStore.getState().generateArtifact({
        title: 'Quarterly Report',
        type: 'report',
        html: '<html>ok</html>',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'art_1',
        repositoryOutputPath: 'outputs/reports/art_1.md',
        repositoryPreviewPath: 'outputs/html/art_1.html',
      }),
    );

    expect(mockedMirrorArtifactToReadyRepositoryOutput).toHaveBeenCalledWith('inst-1', artifact, '<html>ok</html>');
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_1', {
      repositoryOutputPath: 'outputs/reports/art_1.md',
      repositoryPreviewPath: 'outputs/html/art_1.html',
    });
  });
});

function createArtifact(): ArtifactMeta {
  return {
    id: 'art_1',
    title: 'Quarterly Report',
    icon: '📊',
    type: 'report',
    source: { type: 'mcp_tool' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
  };
}
