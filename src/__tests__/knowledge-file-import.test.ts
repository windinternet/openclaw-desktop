import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_IMPORT_ACCEPT, resolveKnowledgeImportFileKind } from '../lib/knowledge-file-import';

describe('knowledge file import', () => {
  it('classifies text files and extractable PDF/Office files for Knowledge imports', () => {
    expect(resolveKnowledgeImportFileKind({ name: 'notes.md', type: 'text/markdown' })).toEqual({
      kind: 'text',
      format: 'markdown',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'brief.txt', type: 'text/plain' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'strategy.pdf', type: 'application/pdf' })).toEqual({
      kind: 'extractable',
      format: 'pdf',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'manual.docx', type: '' })).toEqual({
      kind: 'extractable',
      format: 'word',
    });
    expect(
      resolveKnowledgeImportFileKind({
        name: 'metrics.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ).toEqual({
      kind: 'extractable',
      format: 'excel',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'demo.pptx', type: '' })).toEqual({
      kind: 'extractable',
      format: 'powerpoint',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'diagram.png', type: 'image/png' })).toEqual({
      kind: 'unsupported',
    });
  });

  it('publishes a native file picker accept list for all supported Knowledge import files', () => {
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.md');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.txt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.pdf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.docx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xlsx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.pptx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/pdf');
  });
});
