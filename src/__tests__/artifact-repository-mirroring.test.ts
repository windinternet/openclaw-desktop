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
    loadMeta: vi.fn(),
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
    mockedArtifactPersistence.loadMeta.mockResolvedValue(null);
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

  it('mirrors an existing artifact into the ready repository on explicit request', async () => {
    const artifact = createArtifact();
    useStore.setState({
      artifacts: [artifact],
    });
    mockedMirrorArtifactToReadyRepositoryOutput.mockResolvedValue({
      outputId: 'art_1',
      outputPath: 'outputs/reports/art_1.md',
      previewPath: 'outputs/html/art_1.html',
    });

    await expect(useStore.getState().mirrorArtifactToRepository('art_1')).resolves.toEqual(
      expect.objectContaining({
        outputPath: 'outputs/reports/art_1.md',
        previewPath: 'outputs/html/art_1.html',
      }),
    );

    expect(mockedArtifactPersistence.loadHtml).toHaveBeenCalledWith('art_1', 1);
    expect(mockedMirrorArtifactToReadyRepositoryOutput).toHaveBeenCalledWith('inst-1', artifact, '<html>ok</html>');
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_1', {
      repositoryOutputPath: 'outputs/reports/art_1.md',
      repositoryPreviewPath: 'outputs/html/art_1.html',
    });
  });

  it('does not mirror an existing artifact without a current instance', async () => {
    useStore.setState({
      currentInstanceId: null,
      artifacts: [createArtifact()],
    });

    await expect(useStore.getState().mirrorArtifactToRepository('art_1')).resolves.toBeNull();

    expect(mockedMirrorArtifactToReadyRepositoryOutput).not.toHaveBeenCalled();
    expect(mockedArtifactService.update).not.toHaveBeenCalled();
  });

  it('publishes an existing artifact on explicit save request', async () => {
    const artifact = createArtifact();
    useStore.setState({
      artifacts: [artifact],
    });

    await expect(useStore.getState().publishArtifact('art_1')).resolves.toBe(true);

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_1', { status: 'published' });
    expect(mockedArtifactService.list).toHaveBeenCalled();
  });

  it('does not publish a missing artifact on explicit save request', async () => {
    await expect(useStore.getState().publishArtifact('missing_artifact')).resolves.toBe(false);

    expect(mockedArtifactService.update).not.toHaveBeenCalled();
  });

  it('imports a local file artifact on explicit import request', async () => {
    const artifact = {
      ...createArtifact(),
      title: 'Roadmap PPT',
      type: 'file' as const,
      filePath: '/artifact-storage/art_1/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      fileName: 'roadmap.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    mockedArtifactService.generate.mockResolvedValue(artifact);

    await expect(
      useStore.getState().importArtifactFromFile({
        title: 'Roadmap PPT',
        filePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    ).resolves.toEqual(artifact);

    expect(mockedArtifactService.generate).toHaveBeenCalledWith({
      title: 'Roadmap PPT',
      type: 'file',
      filePath: '/Users/deepin/Documents/roadmap.pptx',
      fileName: 'roadmap.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      importFile: true,
      source: { type: 'manual' },
    });
    expect(mockedArtifactService.list).toHaveBeenCalled();
    expect(mockedMirrorArtifactToReadyRepositoryOutput).not.toHaveBeenCalled();
  });

  it('does not import a local file artifact without a file path', async () => {
    await expect(useStore.getState().importArtifactFromFile({ title: 'Missing path' })).resolves.toBeNull();

    expect(mockedArtifactService.generate).not.toHaveBeenCalled();
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
