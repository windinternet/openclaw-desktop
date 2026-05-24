function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function joinText(parts: unknown[]): string {
  return parts.map(extractSessionMessageText).filter(Boolean).join('\n');
}

export function decodeSessionKeyParam(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractSessionMessageText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return joinText(value);
  if (!isRecord(value)) return '';

  for (const key of ['text', 'content', 'value', 'message', 'delta', 'output_text']) {
    const text = extractSessionMessageText(value[key]);
    if (text) return text;
  }

  for (const key of ['children', 'parts', 'items', 'inputContents']) {
    const text = extractSessionMessageText(value[key]);
    if (text) return text;
  }

  return '';
}

export function extractSessionMessageItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  for (const key of ['items', 'messages', 'history', 'transcript']) {
    const items = value[key];
    if (Array.isArray(items)) return items;
  }

  if (isRecord(value.session)) {
    const items = extractSessionMessageItems(value.session);
    if (items.length > 0) return items;
  }

  if (Array.isArray(value.previews)) {
    for (const preview of value.previews) {
      const items = extractSessionMessageItems(preview);
      if (items.length > 0) return items;
    }
  }

  return [];
}
