import { beforeEach, describe, expect, it, vi } from 'vitest';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';

vi.mock('../lib/artifact-persistence', () => ({
  artifactPersistence: {
    importFile: vi.fn(),
    readImportedText: vi.fn(),
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
    mockedPersistence.readImportedText.mockResolvedValue({
      text: '# 推进计划\n\nShip the content extraction slice.',
      bytesRead: 58,
      truncated: false,
    });
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
    expect(mockedPersistence.readImportedText).not.toHaveBeenCalled();
    expect(artifact).toEqual(
      expect.objectContaining({
        filePath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
        originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        fileInspection: expect.objectContaining({
          format: 'powerpoint',
          sourceKind: 'imported_file',
          openBehavior: 'open_file',
          previewStatus: 'external_app',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          storedPath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
          originalPath: '/Users/deepin/Documents/roadmap.pptx',
          limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
        }),
      }),
    );
    expect(mockedPersistence.saveMeta).toHaveBeenCalledWith(
      artifact.id,
      expect.objectContaining({
        filePath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
        originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        fileInspection: expect.objectContaining({
          format: 'powerpoint',
          sourceKind: 'imported_file',
          previewStatus: 'external_app',
        }),
      }),
    );
  });

  it('automatically extracts imported text artifact content into metadata', async () => {
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/plan.md',
      fileName: 'plan.md',
      fileSize: 128,
      mimeType: 'text/markdown',
    });

    const artifact = await artifactService.generate({
      title: '推进计划',
      type: 'file',
      filePath: '/Users/deepin/Documents/plan.md',
      fileName: 'plan.md',
      mimeType: 'text/markdown',
      importFile: true,
    });

    expect(mockedPersistence.readImportedText).toHaveBeenCalledWith(artifact.id);
    expect(artifact).toEqual(
      expect.objectContaining({
        filePath: '/user-data/storage/artifacts/art_1/files/plan.md',
        originalFilePath: '/Users/deepin/Documents/plan.md',
        externalFormat: 'text',
        contentExtract: expect.objectContaining({
          status: 'extracted',
          format: 'text',
          sourceKind: 'imported_file',
          fileName: 'plan.md',
          mimeType: 'text/markdown',
          bytesRead: 58,
          truncated: false,
          snippet: '# 推进计划\n\nShip the content extraction slice.',
        }),
      }),
    );
    expect(mockedPersistence.saveMeta).toHaveBeenCalledWith(
      artifact.id,
      expect.objectContaining({
        contentExtract: expect.objectContaining({
          status: 'extracted',
          snippet: '# 推进计划\n\nShip the content extraction slice.',
        }),
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
    expect(artifact.externalFormat).toBe('excel');
    expect(artifact.contentSummary).toBe('Excel · reference.xlsx');
  });
});
