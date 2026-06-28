export type KnowledgeExtractedFileFormat = 'pdf' | 'word' | 'excel' | 'powerpoint';

export type KnowledgeImportFileKind =
  | { kind: 'text'; format: 'markdown' | 'text' }
  | { kind: 'extractable'; format: KnowledgeExtractedFileFormat }
  | { kind: 'unsupported' };

export interface KnowledgeImportFileLike {
  name: string;
  type?: string;
}

export const KNOWLEDGE_IMPORT_ACCEPT = [
  '.md',
  '.markdown',
  '.txt',
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  'text/markdown',
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',');

export function resolveKnowledgeImportFileKind(file: KnowledgeImportFileLike): KnowledgeImportFileKind {
  const lowerName = file.name.toLowerCase();
  const lowerType = (file.type ?? '').toLowerCase();

  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown') || lowerType === 'text/markdown') {
    return { kind: 'text', format: 'markdown' };
  }
  if (lowerName.endsWith('.txt') || lowerType === 'text/plain' || lowerType.startsWith('text/')) {
    return { kind: 'text', format: 'text' };
  }
  if (lowerName.endsWith('.pdf') || lowerType === 'application/pdf') {
    return { kind: 'extractable', format: 'pdf' };
  }
  if (
    lowerName.endsWith('.docx') ||
    lowerType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { kind: 'extractable', format: 'word' };
  }
  if (
    lowerName.endsWith('.xlsx') ||
    lowerType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return { kind: 'extractable', format: 'excel' };
  }
  if (
    lowerName.endsWith('.pptx') ||
    lowerType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return { kind: 'extractable', format: 'powerpoint' };
  }

  return { kind: 'unsupported' };
}
