export interface ArtifactBridgeFetchRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  maxBytes: number;
}

export interface ArtifactBridgeFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  truncated: boolean;
}

const DEFAULT_MAX_BYTES = 512 * 1024;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

export function resolveArtifactBridgeFetchRequest(params: Record<string, unknown>): ArtifactBridgeFetchRequest {
  const urlValue = params.url;
  if (typeof urlValue !== 'string' || !urlValue.trim()) {
    throw new Error('Missing artifact bridge parameter: url');
  }

  const url = new URL(urlValue.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Artifact Bridge fetch only allows http(s) URLs');
  }

  const init = isRecord(params.init) ? params.init : {};
  const method = normalizeFetchMethod(init.method);
  const body = typeof init.body === 'string' && method !== 'GET' && method !== 'HEAD' ? init.body : undefined;

  return {
    url: url.toString(),
    method,
    headers: normalizeFetchHeaders(init.headers),
    body,
    maxBytes: normalizeMaxBytes(params.maxBytes),
  };
}

export async function buildArtifactBridgeFetchResponse(
  response: Response,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<ArtifactBridgeFetchResponse> {
  const buffer = Buffer.from(await response.arrayBuffer());
  const bodyBuffer = buffer.subarray(0, Math.max(0, maxBytes));
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers,
    body: bodyBuffer.toString('utf-8'),
    bytes: bodyBuffer.length,
    truncated: buffer.length > bodyBuffer.length,
  };
}

function normalizeFetchMethod(value: unknown): string {
  const method = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'GET';
  if (!ALLOWED_METHODS.has(method)) throw new Error('Artifact Bridge fetch method is not allowed');
  return method;
}

function normalizeFetchHeaders(value: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      if (typeof entry[0] !== 'string') continue;
      headers[entry[0]] = String(entry[1]);
    }
    return headers;
  }

  if (!isRecord(value)) return headers;
  for (const [key, headerValue] of Object.entries(value)) {
    headers[key] = String(headerValue);
  }
  return headers;
}

function normalizeMaxBytes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_BYTES;
  return Math.max(1024, Math.min(Math.trunc(value), DEFAULT_MAX_BYTES));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
