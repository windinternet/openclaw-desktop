import { describe, expect, it } from 'vitest';
import { parseArtifactsFromText } from '../lib/artifact-parser';

describe('artifact parser', () => {
  it('extracts multiple artifact blocks from one assistant response', () => {
    const parsed = parseArtifactsFromText([
      '<artifact>',
      '{"title":"周报","type":"report"}',
      '<!doctype html><html><body>report</body></html>',
      '</artifact>',
      '中间说明文字',
      '<artifact>',
      '{"title":"执行清单","type":"checklist","tags":["todo"]}',
      '<!doctype html><html><body>checklist</body></html>',
      '</artifact>',
    ].join('\n'));

    expect(parsed.map((artifact) => artifact.title)).toEqual(['周报', '执行清单']);
    expect(parsed[1].tags).toEqual(['todo']);
  });

  it('preserves non-HTML artifact metadata from artifact block headers', () => {
    const parsed = parseArtifactsFromText([
      '<artifact>',
      JSON.stringify({
        title: '路线图 PPT',
        type: 'file',
        filePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        importFile: true,
      }),
      '</artifact>',
    ].join('\n'));

    expect(parsed[0]).toEqual(
      expect.objectContaining({
        title: '路线图 PPT',
        type: 'file',
        filePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        importFile: true,
      }),
    );
  });
});
