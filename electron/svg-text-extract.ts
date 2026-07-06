export interface SvgTextExtractResult {
  text: string;
  bytesRead: number;
  truncated: boolean;
}

const MAX_SVG_TEXT_CHARS = 200_000;

export function extractSvgTextFromBuffer(bytes: Uint8Array): SvgTextExtractResult {
  const svg = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  let text = extractSvgText(svg);
  let truncated = false;
  if (text.length > MAX_SVG_TEXT_CHARS) {
    text = text.slice(0, MAX_SVG_TEXT_CHARS).trim();
    truncated = true;
  }

  return {
    text,
    bytesRead: bytes.byteLength,
    truncated,
  };
}

function extractSvgText(svg: string): string {
  const parts: string[] = [];
  for (const tag of ['title', 'desc', 'text']) {
    const tagPattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(svg))) {
      const text = normalizeSvgText(match[1] ?? '');
      if (text) parts.push(text);
    }
  }
  return Array.from(new Set(parts)).join('\n');
}

function normalizeSvgText(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}
