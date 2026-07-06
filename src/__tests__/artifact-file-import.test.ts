import { beforeEach, describe, expect, it, vi } from 'vitest';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';

vi.mock('../lib/artifact-persistence', () => ({
  artifactPersistence: {
    importFile: vi.fn(),
    readImportedText: vi.fn(),
    readImportedFileFacts: vi.fn(),
    readImportedImageThumbnail: vi.fn(),
    readImportedNativeThumbnail: vi.fn(),
    readImportedDocumentPreview: vi.fn(),
    loadMeta: vi.fn(),
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
    mockedPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 4096,
      bytesRead: 4096,
      sha256: 'a'.repeat(64),
      signatureHex: '504b0304140000000800',
    });
    mockedPersistence.readImportedImageThumbnail.mockResolvedValue({
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      bytesRead: 2048,
      mimeType: 'image/png',
    });
    mockedPersistence.readImportedNativeThumbnail.mockResolvedValue({
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      bytesRead: 2048,
      mimeType: 'image/png',
    });
    mockedPersistence.readImportedDocumentPreview.mockResolvedValue({
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjE=',
      bytesRead: 2048,
      mimeType: 'application/pdf',
    });
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
      fileName: 'roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
  });

  it('copies file artifacts into Artifact storage and records the original path', async () => {
    mockedPersistence.readImportedText.mockResolvedValue({
      text: 'Quarterly Roadmap Delivery risks',
      bytesRead: 8192,
      truncated: false,
    });

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
    expect(mockedPersistence.readImportedText).toHaveBeenCalledWith(artifact.id);
    expect(mockedPersistence.readImportedFileFacts).toHaveBeenCalledWith(artifact.id);
    expect(mockedPersistence.readImportedImageThumbnail).not.toHaveBeenCalled();
    expect(mockedPersistence.readImportedNativeThumbnail).toHaveBeenCalledWith(artifact.id);
    expect(artifact).toEqual(
      expect.objectContaining({
        filePath: '/user-data/storage/artifacts/art_1/files/roadmap.pptx',
        originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        contentFacts: expect.objectContaining({
          status: 'recorded',
          format: 'powerpoint',
          sourceKind: 'imported_file',
          summary: 'PowerPoint facts · roadmap.pptx · 4 KB · sha256 aaaaaaaaaaaa',
          fileName: 'roadmap.pptx',
          bytesRead: 4096,
          sha256: 'a'.repeat(64),
          signatureHex: '504b0304140000000800',
        }),
        contentExtract: expect.objectContaining({
          status: 'extracted',
          format: 'powerpoint',
          sourceKind: 'imported_file',
          summary: 'PowerPoint text extract · roadmap.pptx · 32 chars',
          snippet: 'Quarterly Roadmap Delivery risks',
        }),
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'content_extract',
            status: 'succeeded',
            format: 'powerpoint',
            resultSummary: 'PowerPoint text extract · roadmap.pptx · 32 chars',
          }),
          expect.objectContaining({
            kind: 'content_facts',
            status: 'succeeded',
            format: 'powerpoint',
            resultSummary: 'PowerPoint facts · roadmap.pptx · 4 KB · sha256 aaaaaaaaaaaa',
          }),
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
            format: 'powerpoint',
            resultSummary: 'thumbnail available',
          }),
        ]),
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
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        previewPlan: expect.objectContaining({
          strategy: 'content_extract_preview',
          surface: 'artifact_detail',
          primaryAction: 'view_detail',
          limitations: ['native-preview-missing'],
          nextSteps: ['open-artifact-detail', 'add-native-preview'],
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
        contentFacts: expect.objectContaining({
          status: 'recorded',
          sha256: 'a'.repeat(64),
        }),
        contentExtract: expect.objectContaining({
          status: 'extracted',
          format: 'powerpoint',
        }),
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'content_extract',
            status: 'succeeded',
          }),
          expect.objectContaining({
            kind: 'content_facts',
            status: 'succeeded',
          }),
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
            format: 'powerpoint',
            resultSummary: 'thumbnail available',
          }),
        ]),
        fileInspection: expect.objectContaining({
          format: 'powerpoint',
          sourceKind: 'imported_file',
          previewStatus: 'external_app',
        }),
        previewPlan: expect.objectContaining({
          strategy: 'content_extract_preview',
          primaryAction: 'view_detail',
          limitations: ['native-preview-missing'],
          nextSteps: ['open-artifact-detail', 'add-native-preview'],
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
    expect(mockedPersistence.readImportedFileFacts).not.toHaveBeenCalled();
    expect(mockedPersistence.readImportedImageThumbnail).not.toHaveBeenCalled();
    expect(artifact).toEqual(
      expect.objectContaining({
        filePath: '/user-data/storage/artifacts/art_1/files/plan.md',
        originalFilePath: '/Users/deepin/Documents/plan.md',
        externalFormat: 'text',
        previewPlan: expect.objectContaining({
          strategy: 'content_extract_preview',
          surface: 'artifact_detail',
          primaryAction: 'view_detail',
          limitations: ['native-preview-missing'],
          nextSteps: ['open-artifact-detail', 'add-native-preview'],
        }),
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
        enrichmentEvents: [
          expect.objectContaining({
            kind: 'content_extract',
            status: 'succeeded',
            format: 'text',
            resultSummary: 'Text extract · plan.md · 42 chars',
          }),
        ],
      }),
    );
    expect(mockedPersistence.saveMeta).toHaveBeenCalledWith(
      artifact.id,
      expect.objectContaining({
        contentExtract: expect.objectContaining({
          status: 'extracted',
          snippet: '# 推进计划\n\nShip the content extraction slice.',
        }),
        enrichmentEvents: [
          expect.objectContaining({
            kind: 'content_extract',
            status: 'succeeded',
          }),
        ],
      }),
    );
  });

  it('automatically extracts best-effort imported PDF text and file facts into metadata', async () => {
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/brief.pdf',
      fileName: 'brief.pdf',
      fileSize: 4096,
      mimeType: 'application/pdf',
    });
    mockedPersistence.readImportedText.mockResolvedValue({
      text: 'Quarterly roadmap and delivery risks.',
      bytesRead: 2048,
      truncated: false,
    });
    mockedPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 4096,
      bytesRead: 4096,
      sha256: 'c'.repeat(64),
      signatureHex: '255044462d312e37',
      pdfInfo: { version: '1.7', pageCount: 3 },
    });

    const artifact = await artifactService.generate({
      title: '路线图 PDF',
      type: 'file',
      filePath: '/Users/deepin/Documents/brief.pdf',
      fileName: 'brief.pdf',
      mimeType: 'application/pdf',
      importFile: true,
    });

    expect(mockedPersistence.readImportedText).toHaveBeenCalledWith(artifact.id);
    expect(mockedPersistence.readImportedFileFacts).toHaveBeenCalledWith(artifact.id);
    expect(mockedPersistence.readImportedNativeThumbnail).toHaveBeenCalledWith(artifact.id);
    expect(mockedPersistence.readImportedDocumentPreview).toHaveBeenCalledWith(artifact.id);
    expect(artifact).toEqual(
      expect.objectContaining({
        externalFormat: 'pdf',
        contentExtract: expect.objectContaining({
          status: 'extracted',
          format: 'pdf',
          summary: 'PDF text extract · brief.pdf · 37 chars',
          snippet: 'Quarterly roadmap and delivery risks.',
        }),
        contentFacts: expect.objectContaining({
          status: 'recorded',
          format: 'pdf',
          pdfInfo: { version: '1.7', pageCount: 3 },
        }),
        documentPreview: expect.objectContaining({
          status: 'available',
          format: 'pdf',
          sourceKind: 'imported_file',
          summary: 'PDF preview · brief.pdf · 2048 B',
          dataUrl: 'data:application/pdf;base64,JVBERi0xLjE=',
        }),
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'content_extract',
            status: 'succeeded',
            format: 'pdf',
          }),
          expect.objectContaining({
            kind: 'content_facts',
            status: 'succeeded',
            format: 'pdf',
          }),
          expect.objectContaining({
            kind: 'document_preview',
            status: 'succeeded',
            format: 'pdf',
            resultSummary: 'PDF preview · brief.pdf · 2048 B',
          }),
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
            format: 'pdf',
            resultSummary: 'thumbnail available',
          }),
        ]),
        previewPlan: expect.objectContaining({
          strategy: 'browser_pdf_viewer',
          surface: 'artifact_detail',
          primaryAction: 'view_detail',
          limitations: [],
          nextSteps: ['open-artifact-detail'],
        }),
      }),
    );
  });

  it('automatically stores native thumbnails for imported video artifacts', async () => {
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/demo.mp4',
      fileName: 'demo.mp4',
      fileSize: 8192,
      mimeType: 'video/mp4',
    });

    const artifact = await artifactService.generate({
      title: '演示视频',
      type: 'video',
      filePath: '/Users/deepin/Movies/demo.mp4',
      fileName: 'demo.mp4',
      mimeType: 'video/mp4',
      importFile: true,
    });

    expect(mockedPersistence.readImportedImageThumbnail).not.toHaveBeenCalled();
    expect(mockedPersistence.readImportedNativeThumbnail).toHaveBeenCalledWith(artifact.id);
    expect(artifact).toEqual(
      expect.objectContaining({
        externalFormat: 'video',
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
            format: 'video',
            resultSummary: 'thumbnail available',
          }),
        ]),
      }),
    );
  });

  it('uses a fallback thumbnail for native thumbnail platform gaps during imported file enrichment', async () => {
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/brief.pdf',
      fileName: 'brief.pdf',
      fileSize: 4096,
      mimeType: 'application/pdf',
    });
    mockedPersistence.readImportedText.mockResolvedValue({
      text: 'Quarterly roadmap and delivery risks.',
      bytesRead: 2048,
      truncated: false,
    });
    mockedPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 4096,
      bytesRead: 4096,
      sha256: 'c'.repeat(64),
      signatureHex: '255044462d312e37',
      pdfInfo: { version: '1.7', pageCount: 3 },
    });
    mockedPersistence.readImportedNativeThumbnail.mockRejectedValue(
      new Error('Native thumbnail extraction requires macOS Quick Look'),
    );

    const artifact = await artifactService.generate({
      title: '路线图 PDF',
      type: 'file',
      filePath: '/Users/deepin/Documents/brief.pdf',
      fileName: 'brief.pdf',
      mimeType: 'application/pdf',
      importFile: true,
    });

    expect(mockedPersistence.readImportedNativeThumbnail).toHaveBeenCalledWith(artifact.id);
    expect(artifact.thumbnail).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(artifact).toEqual(
      expect.objectContaining({
        externalFormat: 'pdf',
        previewPlan: expect.objectContaining({
          limitations: expect.not.arrayContaining(['thumbnail-missing']),
        }),
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'unavailable',
            format: 'pdf',
            reason: 'native-thumbnail-platform-unsupported',
            resultSummary: 'fallback thumbnail available',
          }),
        ]),
      }),
    );
  });

  it('generates a fallback thumbnail for generic imported files', async () => {
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/archive.bin',
      fileName: 'archive.bin',
      fileSize: 4096,
      mimeType: 'application/octet-stream',
    });

    const artifact = await artifactService.generate({
      title: '二进制附件',
      type: 'file',
      filePath: '/Users/deepin/Documents/archive.bin',
      fileName: 'archive.bin',
      mimeType: 'application/octet-stream',
      importFile: true,
    });

    expect(mockedPersistence.readImportedImageThumbnail).not.toHaveBeenCalled();
    expect(mockedPersistence.readImportedNativeThumbnail).not.toHaveBeenCalled();
    expect(artifact.thumbnail).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(artifact).toEqual(
      expect.objectContaining({
        externalFormat: 'file',
        previewPlan: expect.objectContaining({
          limitations: expect.not.arrayContaining(['thumbnail-missing']),
        }),
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
            format: 'file',
            resultSummary: 'fallback thumbnail available',
          }),
        ]),
      }),
    );
  });

  it('imports an existing local PDF artifact copy and reuses the enrichment pipeline', async () => {
    mockedPersistence.loadMeta.mockResolvedValue({
      id: 'art_pdf',
      title: '本地路线图 PDF',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      filePath: '/Users/deepin/Documents/local-brief.pdf',
      fileName: 'local-brief.pdf',
      mimeType: 'application/pdf',
      externalFormat: 'pdf',
      contentSummary: 'PDF · local-brief.pdf',
    });
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_pdf/files/local-brief.pdf',
      fileName: 'local-brief.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
    });
    mockedPersistence.readImportedText.mockResolvedValue({
      text: 'Local PDF roadmap evidence.',
      bytesRead: 1024,
      truncated: false,
    });
    mockedPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 2048,
      bytesRead: 2048,
      sha256: 'd'.repeat(64),
      signatureHex: '255044462d312e37',
      pdfInfo: { version: '1.7', pageCount: 2 },
    });

    const artifact = await artifactService.importFileCopy('art_pdf');

    expect(mockedPersistence.importFile).toHaveBeenCalledWith(
      'art_pdf',
      '/Users/deepin/Documents/local-brief.pdf',
      'local-brief.pdf',
    );
    expect(mockedPersistence.readImportedText).toHaveBeenCalledWith('art_pdf');
    expect(mockedPersistence.readImportedFileFacts).toHaveBeenCalledWith('art_pdf');
    expect(mockedPersistence.readImportedNativeThumbnail).toHaveBeenCalledWith('art_pdf');
    expect(mockedPersistence.readImportedDocumentPreview).toHaveBeenCalledWith('art_pdf');
    expect(artifact).toEqual(
      expect.objectContaining({
        id: 'art_pdf',
        filePath: '/user-data/storage/artifacts/art_pdf/files/local-brief.pdf',
        originalFilePath: '/Users/deepin/Documents/local-brief.pdf',
        fileName: 'local-brief.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        externalFormat: 'pdf',
        contentSummary: 'PDF · local-brief.pdf · 2 KB',
        contentExtract: expect.objectContaining({
          status: 'extracted',
          format: 'pdf',
          snippet: 'Local PDF roadmap evidence.',
        }),
        contentFacts: expect.objectContaining({
          status: 'recorded',
          format: 'pdf',
          sha256: 'd'.repeat(64),
          pdfInfo: { version: '1.7', pageCount: 2 },
        }),
        documentPreview: expect.objectContaining({
          status: 'available',
          format: 'pdf',
          summary: 'PDF preview · local-brief.pdf · 2048 B',
        }),
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        previewPlan: expect.objectContaining({
          limitations: [],
        }),
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({ kind: 'content_extract', status: 'succeeded' }),
          expect.objectContaining({ kind: 'content_facts', status: 'succeeded' }),
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
            format: 'pdf',
            resultSummary: 'thumbnail available',
          }),
          expect.objectContaining({ kind: 'document_preview', status: 'succeeded' }),
        ]),
      }),
    );
    expect(mockedPersistence.saveMeta).toHaveBeenCalledWith(
      'art_pdf',
      expect.objectContaining({
        originalFilePath: '/Users/deepin/Documents/local-brief.pdf',
        documentPreview: expect.objectContaining({
          status: 'available',
        }),
      }),
    );
    expect(mockedPersistence.updateIndex).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'art_pdf',
        originalFilePath: '/Users/deepin/Documents/local-brief.pdf',
      }),
    ]);
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

  it('automatically stores a thumbnail for imported image artifacts', async () => {
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/cover.png',
      fileName: 'cover.png',
      fileSize: 2048,
      mimeType: 'image/png',
    });
    mockedPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 2048,
      bytesRead: 2048,
      sha256: 'b'.repeat(64),
      signatureHex: '89504e470d0a1a0a',
      imageDimensions: { width: 320, height: 180, kind: 'png' },
    });

    const artifact = await artifactService.generate({
      title: '封面图',
      type: 'image',
      filePath: '/Users/deepin/Pictures/cover.png',
      fileName: 'cover.png',
      mimeType: 'image/png',
      importFile: true,
    });

    expect(mockedPersistence.readImportedImageThumbnail).toHaveBeenCalledWith(artifact.id);
    expect(mockedPersistence.readImportedNativeThumbnail).not.toHaveBeenCalled();
    expect(artifact).toEqual(
      expect.objectContaining({
        externalFormat: 'image',
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'content_facts',
            status: 'succeeded',
            format: 'image',
          }),
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
            format: 'image',
            resultSummary: 'thumbnail available',
          }),
        ]),
        previewPlan: expect.objectContaining({
          limitations: ['native-preview-missing', 'content-extraction-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview', 'add-content-extraction'],
        }),
      }),
    );
    expect(mockedPersistence.saveMeta).toHaveBeenCalledWith(
      artifact.id,
      expect.objectContaining({
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        enrichmentEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'thumbnail',
            status: 'succeeded',
          }),
        ]),
      }),
    );
  });

  it('keeps imported artifacts when automatic enrichment fails and records the failure', async () => {
    mockedPersistence.importFile.mockResolvedValue({
      filePath: '/user-data/storage/artifacts/art_1/files/brief.pdf',
      fileName: 'brief.pdf',
      fileSize: 4096,
      mimeType: 'application/pdf',
    });
    mockedPersistence.readImportedText.mockRejectedValue(new Error('PDF stream decode failed'));
    mockedPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 4096,
      bytesRead: 4096,
      sha256: 'c'.repeat(64),
      signatureHex: '255044462d312e37',
    });

    const artifact = await artifactService.generate({
      title: '路线图 PDF',
      type: 'file',
      filePath: '/Users/deepin/Documents/brief.pdf',
      fileName: 'brief.pdf',
      mimeType: 'application/pdf',
      importFile: true,
    });

    expect(artifact.contentExtract).toBeUndefined();
    expect(artifact.contentFacts).toEqual(expect.objectContaining({ status: 'recorded', format: 'pdf' }));
    expect(artifact.enrichmentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'content_extract',
          status: 'failed',
          format: 'pdf',
          error: 'PDF stream decode failed',
        }),
        expect.objectContaining({
          kind: 'content_facts',
          status: 'succeeded',
          format: 'pdf',
        }),
      ]),
    );
  });
});
