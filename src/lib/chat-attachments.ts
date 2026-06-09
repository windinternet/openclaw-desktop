type AttachmentLike = Record<string, unknown>;

export interface GatewayChatAttachment {
  id: string;
  name: string;
  contentType?: string;
  mimeType?: string;
  size?: number | string;
  url?: string;
  data?: string;
  extractedText?: string | null;
}

export interface GatewayChatSendPayload {
  message: string;
  sessionKey: string;
  idempotencyKey: string;
  attachments?: Array<{
    name: string;
    url: string;
    contentType: string;
    extractedText?: string;
  }>;
  content?: Array<
    | { type: 'text'; text: string }
    | {
        type: 'file' | 'image';
        id: string;
        name: string;
        contentType?: string;
        mimeType?: string;
        size?: number | string;
        url?: string;
        data?: string;
        extractedText?: string | null;
      }
  >;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractChatInputText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(extractChatInputText).filter(Boolean).join('\n');
  if (!isRecord(value)) return '';
  if (Array.isArray(value.inputContents)) return extractChatInputText(value.inputContents);
  for (const key of ['text', 'content', 'value', 'message', 'children']) {
    const text = extractChatInputText(value[key]);
    if (text) return text;
  }
  return '';
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function getMimeTypeFromDataUrl(url?: string): string | undefined {
  if (!url?.startsWith('data:')) return undefined;
  const match = /^data:([^;,]+)/.exec(url);
  return match?.[1];
}

function getMimeTypeFromName(name: string): string | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  if (['png'].includes(ext)) return 'image/png';
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (['gif'].includes(ext)) return 'image/gif';
  if (['webp'].includes(ext)) return 'image/webp';
  if (['txt', 'md'].includes(ext)) return 'text/plain';
  if (ext === 'json') return 'application/json';
  if (ext === 'pdf') return 'application/pdf';
  return undefined;
}

function isImageAttachment(attachment: GatewayChatAttachment): boolean {
  const contentType = attachment.contentType ?? attachment.mimeType;
  if (contentType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachment.name);
}

function isTextAttachment(attachment: GatewayChatAttachment): boolean {
  const contentType = attachment.contentType ?? attachment.mimeType ?? '';
  return contentType.startsWith('text/')
    || ['application/json', 'application/xml', 'text/xml'].includes(contentType);
}

function getAttachmentFallbackMessage(attachments: GatewayChatAttachment[]): string {
  return attachments.map((attachment) => attachment.name).filter(Boolean).join('\n');
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    output += BASE64_ALPHABET[a >> 2];
    output += BASE64_ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[(c ?? 0) & 63] : '=';
  }
  return output;
}

async function readFileAsDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:${file.type || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
}

async function readFileText(file: File): Promise<string | undefined> {
  try {
    const text = (await file.text()).trim();
    if (!text) return undefined;
    return text.length > 12_000 ? `${text.slice(0, 12_000).trimEnd()}\n[Truncated]` : text;
  } catch {
    return undefined;
  }
}

export function extractChatInputAttachments(content: unknown): AttachmentLike[] {
  if (!isRecord(content)) return [];
  return Array.isArray(content.attachments)
    ? content.attachments.filter(isRecord)
    : [];
}

export async function normalizeChatInputAttachments(attachments: unknown[]): Promise<GatewayChatAttachment[]> {
  const normalized: GatewayChatAttachment[] = [];

  for (const raw of attachments) {
    if (!isRecord(raw)) continue;
    const name = getString(raw.name ?? raw.filename ?? raw.fileName);
    if (!name) continue;

    const file = raw.fileInstance instanceof File ? raw.fileInstance : undefined;
    const url = getString(raw.url ?? raw.file_url ?? raw.image_url);
    const data = getString(raw.data ?? raw.file_data);
    const id = getString(raw.uid ?? raw.id ?? raw.file_id) ?? `${name}-${normalized.length}`;
    const contentType = getString(raw.contentType ?? raw.mimeType ?? raw.type)
      ?? (file?.type || undefined)
      ?? getMimeTypeFromDataUrl(data ?? url)
      ?? getMimeTypeFromName(name);
    const size = typeof raw.size === 'number' || typeof raw.size === 'string'
      ? raw.size
      : file?.size;

    const attachment: GatewayChatAttachment = {
      id,
      name,
      contentType,
      mimeType: contentType,
      size,
      url: url?.startsWith('blob:') ? undefined : url,
      data: data ?? (file ? await readFileAsDataUrl(file) : undefined),
      extractedText: getString(raw.extractedText),
    };
    if (!attachment.url) attachment.url = attachment.data;
    if (!attachment.extractedText && file && isTextAttachment(attachment)) {
      attachment.extractedText = await readFileText(file);
    }
    normalized.push(attachment);
  }

  return normalized;
}

export function buildSemiMessageContent(
  text: string,
  attachments: GatewayChatAttachment[],
): [{
  type: 'message';
  content: Array<
    | { type: 'input_text'; text: string }
    | {
        type: 'input_file';
        file_url?: string;
        file_data?: string;
        filename: string;
        size?: string;
        file_type?: string;
      }
    | {
        type: 'input_image';
        image_url?: string;
        file_data?: string;
        detail: 'auto';
      }
  >;
}] {
  const content: ReturnType<typeof buildSemiMessageContent>[0]['content'] = [];

  for (const attachment of attachments) {
    if (isImageAttachment(attachment)) {
      content.push({
        type: 'input_image',
        image_url: attachment.url ?? attachment.data,
        file_data: attachment.data,
        detail: 'auto',
      });
    } else {
      content.push({
        type: 'input_file',
        file_url: attachment.url ?? attachment.data,
        file_data: attachment.data,
        filename: attachment.name,
        size: attachment.size != null ? String(attachment.size) : undefined,
        file_type: attachment.contentType ?? attachment.mimeType,
      });
    }
  }

  if (text) content.push({ type: 'input_text', text });

  return [{ type: 'message', content }];
}

export async function buildGatewayChatSendPayload(options: {
  inputContent: unknown;
  sessionKey: string;
  idempotencyKey: string;
  messageOverride?: string;
}): Promise<GatewayChatSendPayload> {
  const attachments = await normalizeChatInputAttachments(extractChatInputAttachments(options.inputContent));
  const inputText = extractChatInputText(options.inputContent).trim();
  const message = options.messageOverride?.trim() || inputText || getAttachmentFallbackMessage(attachments);
  const content: GatewayChatSendPayload['content'] = [];

  if (message) content.push({ type: 'text', text: message });
  for (const attachment of attachments) {
    content.push({
      type: isImageAttachment(attachment) ? 'image' : 'file',
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      contentType: attachment.contentType ?? attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      data: attachment.data,
      extractedText: attachment.extractedText,
    });
  }

  return {
    message,
    sessionKey: options.sessionKey,
    idempotencyKey: options.idempotencyKey,
    attachments: attachments.length > 0
      ? attachments.map((attachment) => ({
          name: attachment.name,
          url: attachment.url ?? attachment.data ?? '',
          contentType: attachment.contentType ?? attachment.mimeType ?? 'application/octet-stream',
          extractedText: attachment.extractedText ?? undefined,
        }))
      : undefined,
    content: content.length > 0 ? content : undefined,
  };
}
