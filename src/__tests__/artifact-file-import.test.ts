import { beforeEach, describe, expect, it, vi } from 'vitest';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';

vi.mock('../lib/artifact-persistence', () => ({
  artifactPersistence: {
    importFile: vi.fn(),
    saveMeta: vi.fn(),
    saveHtml: vi.fn(),
    list: vi.fn(),
    updateIndex: vi.fn(),
  },
}));

const mockedPersistence = vi.mocked(artifactPersistence);

describe('artifact file import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPersistence.list.mockResolvedValue([]);
    mockedPersistence.updateIndex.mockResolvedValue(undefined);
    mockedPersistence.saveMeta.mockResolvedValue(undefined);
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
      fileName: 'roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
  });

  it('copies file artifacts into Artifact storage and records the original path', async () => {
    const artifact = await artifactService.generate({
      title: '路线图 PPT',
      type: 'file',
      filePath: '/Users/deepin/Documents/roadmap.pptx',
      fileName: 'roadmap.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      importFile: true,
    });

    expect(mockedPersistence.importFile).toHaveBeenCalledWith(
      artifact.id,
      '/Users/deepin/Documents/roadmap.pptx',
      'roadmap.pptx',
    );
    expect(artifact).toEqual(
      expect.objectContaining({
        filePath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
        originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    );
    expect(mockedPersistence.saveMeta).toHaveBeenCalledWith(
      artifact.id,
      expect.objectContaining({
        filePath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
        originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      }),
    );
  });

  it('keeps external file references when import is not requested', async () => {
    const artifact = await artifactService.generate({
      title: '外部文件引用',
      type: 'file',
      filePath: '/Users/deepin/Documents/reference.xlsx',
      fileName: 'reference.xlsx',
    });

    expect(mockedPersistence.importFile).not.toHaveBeenCalled();
    expect(artifact.filePath).toBe('/Users/deepin/Documents/reference.xlsx');
    expect(artifact.originalFilePath).toBeUndefined();
  });
});
