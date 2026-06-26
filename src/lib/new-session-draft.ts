function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isParagraphLike(value: unknown): boolean {
  return isRecord(value) && ['paragraph', 'heading', 'blockquote', 'listItem'].includes(String(value.type || ''));
}

function joinContentArray(items: unknown[]): string {
  const separator = items.some(isParagraphLike) ? '\n' : '';
  return items.map(extractDraftText).join(separator);
}

export function extractDraftText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return joinContentArray(content);
  if (!isRecord(content)) return String(content);

  if (content.type === 'hardBreak') return '\n';
  if (Array.isArray(content.inputContents)) return extractDraftText(content.inputContents);
  if (typeof content.text === 'string') return content.text;
  if (typeof content.content === 'string') return content.content;
  if (typeof content.value === 'string') return content.value;
  if (Array.isArray(content.content)) return extractDraftText(content.content);
  if (Array.isArray(content.children)) return extractDraftText(content.children);
  return '';
}
