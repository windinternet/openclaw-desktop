import { app, BrowserWindow, dialog, ipcMain, Notification, protocol, shell } from 'electron';
import path from 'node:path';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from 'node:fs';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { ARTIFACT_IPC } from '../src/lib/artifact-ipc';
import { buildArtifactBridgeFetchResponse, resolveArtifactBridgeFetchRequest } from '../src/lib/artifact-bridge-fetch';
import { decideArtifactOpenTarget } from '../src/lib/artifact-open-target';
import { resolveArtifactExportRequest } from '../src/lib/artifact-export';
import { extractOoxmlTextFromBuffer, type OoxmlTextExtractFormat } from './artifact-ooxml-text-extract';
import { extractPdfTextFromBuffer } from './artifact-pdf-text-extract';
import {
  recordArtifactAuthDecision,
  recordArtifactBridgeCallResult,
  recordArtifactBridgeExecApprovalRequired,
} from '../src/lib/artifact-runtime-auth';
import { inferArtifactExternalFormat } from '../src/lib/artifact-value-summary';
import type { ArtifactBridgeCallStatus, ArtifactMeta, ArtifactPdfFacts } from '../src/lib/artifact-types';

function artifactsRoot(): string {
  return path.join(app.getPath('userData'), 'storage', 'artifacts');
}

function artifactDir(artifactId: string): string {
  if (!/^art_[a-z0-9]+$/.test(artifactId)) throw new Error('Invalid artifact id');
  return path.join(artifactsRoot(), artifactId);
}

function metaPath(artifactId: string): string {
  return path.join(artifactDir(artifactId), 'meta.json');
}

function htmlPath(artifactId: string, version: number): string {
  return path.join(artifactDir(artifactId), `v${version}.html`);
}

function filesDir(artifactId: string): string {
  return path.join(artifactDir(artifactId), 'files');
}

function indexPath(): string {
  return path.join(artifactsRoot(), 'index.json');
}

const CSP_HEADER = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "media-src 'self'",
].join('; ');

const BRIDGE_SCRIPT = `(function(){function s(m,a){var b=window.openclawArtifactBridge;if(!b||typeof b.invoke!=="function")return Promise.reject(new Error("Artifact bridge unavailable"));return b.invoke(m,a||{})}window.artifactBridge={getMeta:function(){return s("getMeta")},getHtml:function(v){return s("getHtml",{version:v})},fetch:function(u,i){return s("fetch",{url:u,init:i})},readFile:function(p){return s("readFile",{path:p})},writeFile:function(p,c){return s("writeFile",{path:p,content:c})},exportAs:function(t,c,n){return s("exportAs",typeof t==="object"?t:{type:t,content:c,fileName:n})},notify:function(t,b){return s("notify",{title:t,body:b})},exec:function(c,o){return s("exec",Object.assign({},o&&typeof o==="object"?o:{},{cmd:c}))}}})();`;

interface ArtifactPreviewWindowContext {
  artifactId: string;
  version: number;
}

interface ArtifactBridgeCallPayload {
  method?: unknown;
  params?: unknown;
}

interface ArtifactBridgeExecution {
  result: unknown;
  resultSummary?: string;
}

class ArtifactBridgeDeniedError extends Error {}

class ArtifactBridgeUnsupportedError extends Error {}

const artifactPreviewWindows = new Map<number, ArtifactPreviewWindowContext>();
const MAX_IMPORTED_TEXT_BYTES = 64 * 1024;
const MAX_IMPORTED_PDF_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORTED_OOXML_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_FILE_FACT_HEADER_BYTES = 64 * 1024;
const MAX_PDF_FACT_SCAN_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_THUMBNAIL_BYTES = 512 * 1024;
const OOXML_TEXT_EXTRACT_FORMATS = new Set(['word', 'excel', 'powerpoint']);
const TEXT_EXTRACT_FORMATS = new Set(['html', 'text', 'code', 'pdf', ...OOXML_TEXT_EXTRACT_FORMATS]);

export function registerArtifactProtocol(): void {
  protocol.handle('artifact', (request) => {
    const url = new URL(request.url);
    const [artifactId, versionPart] = url.hostname.split('.');
    const versionStr = versionPart.replace('v', '');
    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version < 1) {
      return new Response('Invalid version', { status: 400 });
    }

    const filePath = htmlPath(artifactId, version);
    if (!existsSync(filePath)) {
      return new Response('Artifact not found', { status: 404 });
    }

    const html = readFileSync(filePath, 'utf-8');
    const injectedHtml = html.replace('</body>', `<script>${BRIDGE_SCRIPT}</script></body>`);

    return new Response(injectedHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': CSP_HEADER,
      },
    });
  });
}

function readMeta(artifactId: string): ArtifactMeta | null {
  const fp = metaPath(artifactId);
  if (!existsSync(fp)) return null;
  return JSON.parse(readFileSync(fp, 'utf-8'));
}

function writeMeta(artifactId: string, meta: ArtifactMeta): void {
  const dir = artifactDir(artifactId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(metaPath(artifactId), JSON.stringify(meta, null, 2));
}

function readIndex(): ArtifactMeta[] {
  const fp = indexPath();
  if (!existsSync(fp)) return [];
  const value = JSON.parse(readFileSync(fp, 'utf-8'));
  return Array.isArray(value) ? value : [];
}

function writeIndexEntry(meta: ArtifactMeta): void {
  const root = artifactsRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  const index = readIndex();
  const existingIndex = index.findIndex((item) => item.id === meta.id);
  if (existingIndex >= 0) index[existingIndex] = meta;
  else index.push(meta);
  writeFileSync(indexPath(), JSON.stringify(index, null, 2));
}

function sanitizeFileName(fileName: string): string {
  const invalid = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  const base = path
    .basename(fileName)
    .split('')
    .map((char) => (invalid.has(char) || char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .trim();
  return base || 'artifact-file';
}

function detectMimeType(fileName: string): string | undefined {
  const ext = path.extname(fileName).toLowerCase();
  const known: Record<string, string> = {
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.json': 'application/json',
    '.js': 'text/javascript',
    '.jsx': 'text/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.py': 'text/x-python',
    '.sh': 'text/x-shellscript',
    '.sql': 'text/x-sql',
    '.html': 'text/html',
    '.css': 'text/css',
  };
  return known[ext];
}

function resolveImportedArtifactStorageFile(artifactId: string): {
  targetPath: string;
  stat: ReturnType<typeof statSync>;
} {
  const meta = readMeta(artifactId);
  if (!meta) throw new Error('Artifact not found');
  if (!meta.filePath || !meta.originalFilePath) throw new Error('Artifact is not an imported file');

  const storageDir = path.resolve(filesDir(artifactId));
  const targetPath = path.resolve(meta.filePath);
  if (targetPath !== storageDir && !targetPath.startsWith(`${storageDir}${path.sep}`)) {
    throw new Error('Imported artifact file is outside artifact storage');
  }

  const stat = statSync(targetPath);
  if (!stat.isFile()) throw new Error('Imported artifact path is not a file');

  return { targetPath, stat };
}

function readImportedArtifactText(artifactId: string): { text: string; bytesRead: number; truncated: boolean } {
  const meta = readMeta(artifactId);
  if (!meta) throw new Error('Artifact not found');
  const format = inferArtifactExternalFormat(meta);
  if (!TEXT_EXTRACT_FORMATS.has(format)) throw new Error(`Artifact format is not text-extractable: ${format}`);

  const { targetPath, stat } = resolveImportedArtifactStorageFile(artifactId);
  if (format === 'pdf') {
    return readImportedArtifactPdfText(targetPath, stat.size);
  }
  if (OOXML_TEXT_EXTRACT_FORMATS.has(format)) {
    return readImportedArtifactOoxmlText(targetPath, stat.size, format as OoxmlTextExtractFormat);
  }

  const bytesToRead = Math.min(stat.size, MAX_IMPORTED_TEXT_BYTES);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(targetPath, 'r');
  let bytesRead = 0;
  try {
    bytesRead = readSync(fd, buffer, 0, bytesToRead, 0);
  } finally {
    closeSync(fd);
  }

  return {
    text: buffer.subarray(0, bytesRead).toString('utf-8'),
    bytesRead,
    truncated: stat.size > bytesRead,
  };
}

function readImportedArtifactPdfText(
  targetPath: string,
  fileSize: number,
): { text: string; bytesRead: number; truncated: boolean } {
  const bytesToRead = Math.min(fileSize, MAX_IMPORTED_PDF_TEXT_BYTES);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(targetPath, 'r');
  let bytesRead = 0;
  try {
    bytesRead = readSync(fd, buffer, 0, bytesToRead, 0);
  } finally {
    closeSync(fd);
  }

  return extractPdfTextFromBuffer(buffer.subarray(0, bytesRead), {
    sourceTruncated: fileSize > bytesRead,
  });
}

function readImportedArtifactOoxmlText(
  targetPath: string,
  fileSize: number,
  format: OoxmlTextExtractFormat,
): { text: string; bytesRead: number; truncated: boolean } {
  const bytesToRead = Math.min(fileSize, MAX_IMPORTED_OOXML_TEXT_BYTES);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(targetPath, 'r');
  let bytesRead = 0;
  try {
    bytesRead = readSync(fd, buffer, 0, bytesToRead, 0);
  } finally {
    closeSync(fd);
  }

  return extractOoxmlTextFromBuffer(buffer.subarray(0, bytesRead), {
    format,
    sourceTruncated: fileSize > bytesRead,
  });
}

function readImportedArtifactFileFacts(artifactId: string): {
  fileSize: number;
  bytesRead: number;
  sha256: string;
  signatureHex: string;
  imageDimensions?: { width: number; height: number; kind: 'png' | 'jpeg' | 'gif' | 'webp' };
  pdfInfo?: ArtifactPdfFacts;
} {
  const { targetPath, stat } = resolveImportedArtifactStorageFile(artifactId);
  const hash = createHash('sha256');
  const chunk = Buffer.alloc(64 * 1024);
  const header = Buffer.alloc(Math.min(stat.size, MAX_FILE_FACT_HEADER_BYTES));
  const pdfScan = Buffer.alloc(Math.min(stat.size, MAX_PDF_FACT_SCAN_BYTES));
  const fd = openSync(targetPath, 'r');
  let bytesRead = 0;
  let headerBytes = 0;
  let pdfScanBytes = 0;
  try {
    while (true) {
      const read = readSync(fd, chunk, 0, chunk.length, null);
      if (read <= 0) break;
      const data = chunk.subarray(0, read);
      hash.update(data);
      if (headerBytes < header.length) {
        const copied = data.copy(header, headerBytes, 0, Math.min(data.length, header.length - headerBytes));
        headerBytes += copied;
      }
      if (pdfScanBytes < pdfScan.length) {
        const copied = data.copy(pdfScan, pdfScanBytes, 0, Math.min(data.length, pdfScan.length - pdfScanBytes));
        pdfScanBytes += copied;
      }
      bytesRead += read;
    }
  } finally {
    closeSync(fd);
  }

  const headerBytesBuffer = header.subarray(0, headerBytes);
  const pdfScanBuffer = pdfScan.subarray(0, pdfScanBytes);
  return {
    fileSize: stat.size,
    bytesRead,
    sha256: hash.digest('hex'),
    signatureHex: headerBytesBuffer.subarray(0, 16).toString('hex'),
    imageDimensions: detectImageDimensions(headerBytesBuffer),
    pdfInfo: detectPdfFacts(pdfScanBuffer),
  };
}

function readImportedArtifactImageThumbnail(artifactId: string): {
  dataUrl: string;
  bytesRead: number;
  mimeType: string;
} {
  const meta = readMeta(artifactId);
  if (!meta) throw new Error('Artifact not found');
  const format = inferArtifactExternalFormat(meta);
  if (format !== 'image') throw new Error(`Artifact format is not image-thumbnailable: ${format}`);

  const { targetPath, stat } = resolveImportedArtifactStorageFile(artifactId);
  if (stat.size > MAX_IMAGE_THUMBNAIL_BYTES) throw new Error('Imported image thumbnail is too large');

  const fileName = meta.fileName ?? path.basename(targetPath);
  const declaredMimeType = meta.mimeType?.toLowerCase();
  const mimeType = declaredMimeType?.startsWith('image/') ? declaredMimeType : detectMimeType(fileName);
  if (!mimeType?.startsWith('image/')) throw new Error('Imported artifact file is not an image');

  const buffer = readFileSync(targetPath);
  return {
    dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
    bytesRead: buffer.length,
    mimeType,
  };
}

function detectImageDimensions(
  header: Buffer,
): { width: number; height: number; kind: 'png' | 'jpeg' | 'gif' | 'webp' } | undefined {
  if (header.length >= 24 && header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20), kind: 'png' };
  }
  if (header.length >= 10 && ['GIF87a', 'GIF89a'].includes(header.subarray(0, 6).toString('ascii'))) {
    return { width: header.readUInt16LE(6), height: header.readUInt16LE(8), kind: 'gif' };
  }
  const jpeg = detectJpegDimensions(header);
  if (jpeg) return jpeg;
  const webp = detectWebpDimensions(header);
  if (webp) return webp;
  return undefined;
}

function detectPdfFacts(bytes: Buffer): ArtifactPdfFacts | undefined {
  if (bytes.length < 8 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') return undefined;
  const header = bytes.subarray(0, Math.min(bytes.length, 32)).toString('latin1');
  const version = header.match(/^%PDF-(\d+\.\d+)/)?.[1];
  const pageCount = detectPdfPageCount(bytes.toString('latin1'));
  if (!version && !pageCount) return undefined;
  return {
    ...(version ? { version } : {}),
    ...(pageCount ? { pageCount } : {}),
  };
}

function detectPdfPageCount(value: string): number | undefined {
  const matches = value.match(/\/Type\s*\/Page\b/g);
  return matches?.length ? matches.length : undefined;
}

function detectJpegDimensions(header: Buffer): { width: number; height: number; kind: 'jpeg' } | undefined {
  if (header.length < 4 || header[0] !== 0xff || header[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < header.length) {
    if (header[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = header[offset + 1];
    if (marker === 0xda || marker === 0xd9) return undefined;
    const length = header.readUInt16BE(offset + 2);
    if (length < 2) return undefined;
    if (isJpegStartOfFrame(marker) && offset + 8 < header.length) {
      return {
        width: header.readUInt16BE(offset + 7),
        height: header.readUInt16BE(offset + 5),
        kind: 'jpeg',
      };
    }
    offset += 2 + length;
  }
  return undefined;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    marker === 0xc0 ||
    marker === 0xc1 ||
    marker === 0xc2 ||
    marker === 0xc3 ||
    marker === 0xc5 ||
    marker === 0xc6 ||
    marker === 0xc7 ||
    marker === 0xc9 ||
    marker === 0xca ||
    marker === 0xcb ||
    marker === 0xcd ||
    marker === 0xce ||
    marker === 0xcf
  );
}

function detectWebpDimensions(header: Buffer): { width: number; height: number; kind: 'webp' } | undefined {
  if (header.length < 30 || header.subarray(0, 4).toString('ascii') !== 'RIFF') return undefined;
  if (header.subarray(8, 12).toString('ascii') !== 'WEBP') return undefined;
  if (header.subarray(12, 16).toString('ascii') !== 'VP8X') return undefined;
  const width = 1 + header.readUIntLE(24, 3);
  const height = 1 + header.readUIntLE(27, 3);
  return { width, height, kind: 'webp' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireStringParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing artifact bridge parameter: ${key}`);
  }
  return value;
}

function optionalStringParam(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getBridgeMainWindow(): BrowserWindow | undefined {
  const windows = BrowserWindow.getAllWindows();
  return windows.find((win) => !artifactPreviewWindows.has(win.webContents.id)) ?? windows[0];
}

async function requestArtifactAuthorization(
  artifactId: string,
  capability: string,
  detail: string,
): Promise<{ granted: boolean; level: string }> {
  const requestedAt = Date.now();
  const recordDecision = (result: { granted: boolean; level: string }) => {
    const decidedAt = Date.now();
    const meta = readMeta(artifactId);
    if (meta) {
      const updatedMeta = recordArtifactAuthDecision(meta, {
        capability,
        detail,
        granted: result.granted,
        level: result.level,
        requestedAt,
        decidedAt,
      });
      writeMeta(artifactId, updatedMeta);
      writeIndexEntry(updatedMeta);
    }
    return result;
  };

  const mainWindow = getBridgeMainWindow();
  if (!mainWindow) return recordDecision({ granted: false, level: 'once' });

  return new Promise<{ granted: boolean; level: string }>((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const settle = (result: { granted: boolean; level: string }) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      ipcMain.removeListener(ARTIFACT_IPC.GRANT_AUTH, handler);
      resolve(recordDecision(result));
    };
    const handler = (_e: unknown, result: { granted: boolean; level: string }) => {
      settle(result);
    };
    ipcMain.on(ARTIFACT_IPC.GRANT_AUTH, handler);
    mainWindow.webContents.send(ARTIFACT_IPC.REQUEST_AUTH, artifactId, capability, detail);
    timeout = setTimeout(() => settle({ granted: false, level: 'once' }), 60000);
  });
}

async function requireArtifactBridgeAuthorization(
  artifactId: string,
  capability: string,
  detail: string,
): Promise<void> {
  const result = await requestArtifactAuthorization(artifactId, capability, detail);
  if (!result.granted) {
    throw new ArtifactBridgeDeniedError(`Artifact bridge ${capability} denied`);
  }
}

function describeBridgeCall(method: string, params: Record<string, unknown>): string | undefined {
  switch (method) {
    case 'getHtml':
      return typeof params.version === 'number' ? `version ${params.version}` : undefined;
    case 'fetch':
      return typeof params.url === 'string' ? params.url : undefined;
    case 'readFile':
    case 'writeFile':
      return typeof params.path === 'string' ? params.path : undefined;
    case 'exportAs':
      if (typeof params.fileName === 'string') return params.fileName;
      return typeof params.type === 'string' ? params.type : undefined;
    case 'notify':
      return typeof params.title === 'string' ? params.title : undefined;
    case 'exec':
      return typeof params.cmd === 'string' ? params.cmd : undefined;
    default:
      return undefined;
  }
}

function bridgeStatusFromError(error: unknown): ArtifactBridgeCallStatus {
  if (error instanceof ArtifactBridgeDeniedError) return 'denied';
  if (error instanceof ArtifactBridgeUnsupportedError) return 'unsupported';
  return 'failed';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function prepareArtifactBridgeExecApproval(
  artifactId: string,
  params: Record<string, unknown>,
): ArtifactBridgeExecution {
  const command = requireStringParam(params, 'cmd');
  const approvalTitle = optionalStringParam(params, 'approvalTitle') ?? 'Artifact Bridge command execution requested';
  const approvalRisk = optionalStringParam(params, 'approvalRisk') ?? 'high';
  const approvalReason =
    optionalStringParam(params, 'approvalReason') ??
    'HTML Artifact requested shell execution; Desktop only records the approval intent.';
  const requestedAt = Date.now();
  const meta = readMeta(artifactId);
  if (!meta) throw new Error('Artifact not found');

  const updatedMeta = recordArtifactBridgeExecApprovalRequired(meta, {
    command,
    approvalTitle,
    approvalRisk,
    approvalReason,
    requestedAt,
  });
  writeMeta(artifactId, updatedMeta);
  writeIndexEntry(updatedMeta);

  const event = updatedMeta.executionEvents?.[updatedMeta.executionEvents.length - 1];

  return {
    result: {
      ok: true,
      artifactId,
      event,
      approval: {
        id: event?.id,
        status: 'pending',
        artifactId,
        artifactUri: `artifact://${artifactId}`,
        title: approvalTitle,
        risk: approvalRisk,
        reason: approvalReason,
        runner: 'artifactBridge.exec',
        command,
        requiresUserApproval: true,
        boundary: {
          recordOnly: true,
          desktopExecutes: false,
          grantsPermission: false,
        },
      },
    },
    resultSummary: 'prepared command execution approval request',
  };
}

function recordArtifactBridgeCall(
  artifactId: string,
  params: {
    method: string;
    detail?: string;
    status: ArtifactBridgeCallStatus;
    resultSummary?: string;
    error?: string;
    startedAt: number;
    endedAt: number;
  },
): void {
  const meta = readMeta(artifactId);
  if (!meta) return;

  const updatedMeta = recordArtifactBridgeCallResult(meta, params);
  writeMeta(artifactId, updatedMeta);
  writeIndexEntry(updatedMeta);
}

async function handleArtifactBridgeCall(
  context: ArtifactPreviewWindowContext,
  payload: ArtifactBridgeCallPayload,
): Promise<unknown> {
  if (!isRecord(payload) || typeof payload.method !== 'string') {
    throw new Error('Invalid artifact bridge call');
  }

  const method = payload.method;
  const params = isRecord(payload.params) ? payload.params : {};
  const detail = describeBridgeCall(method, params);
  const startedAt = Date.now();

  try {
    const execution = await executeArtifactBridgeCall(context, method, params, detail);
    const endedAt = Date.now();
    recordArtifactBridgeCall(context.artifactId, {
      method,
      detail,
      status: 'succeeded',
      resultSummary: execution.resultSummary,
      startedAt,
      endedAt,
    });
    return execution.result;
  } catch (error) {
    const endedAt = Date.now();
    recordArtifactBridgeCall(context.artifactId, {
      method,
      detail,
      status: bridgeStatusFromError(error),
      error: errorMessage(error),
      startedAt,
      endedAt,
    });
    throw error;
  }
}

async function executeArtifactBridgeCall(
  context: ArtifactPreviewWindowContext,
  method: string,
  params: Record<string, unknown>,
  detail?: string,
): Promise<ArtifactBridgeExecution> {
  switch (method) {
    case 'getMeta':
      return { result: readMeta(context.artifactId), resultSummary: 'metadata loaded' };
    case 'getHtml': {
      const requestedVersion = params.version;
      const version =
        typeof requestedVersion === 'number' && Number.isInteger(requestedVersion) ? requestedVersion : context.version;
      const fp = htmlPath(context.artifactId, version);
      if (!existsSync(fp)) return { result: null, resultSummary: `version ${version} html missing` };
      const html = readFileSync(fp, 'utf-8');
      return { result: html, resultSummary: `version ${version} html ${html.length} chars` };
    }
    case 'readFile': {
      const filePath = requireStringParam(params, 'path');
      await requireArtifactBridgeAuthorization(context.artifactId, 'readFile', detail ?? filePath);
      const content = readFileSync(filePath, 'utf-8');
      return {
        result: content,
        resultSummary: `read ${Buffer.byteLength(content, 'utf-8')} bytes`,
      };
    }
    case 'writeFile': {
      const filePath = requireStringParam(params, 'path');
      const content = String(params.content ?? '');
      await requireArtifactBridgeAuthorization(context.artifactId, 'writeFile', detail ?? filePath);
      writeFileSync(filePath, content, 'utf-8');
      return {
        result: {
          ok: true,
          path: filePath,
          bytes: Buffer.byteLength(content, 'utf-8'),
        },
        resultSummary: `wrote ${Buffer.byteLength(content, 'utf-8')} bytes`,
      };
    }
    case 'notify': {
      const title = typeof params.title === 'string' ? params.title : 'OpenClaw Artifact';
      const body = typeof params.body === 'string' ? params.body : '';
      await requireArtifactBridgeAuthorization(context.artifactId, 'notify', detail ?? title);
      const supported = Notification.isSupported();
      if (supported) new Notification({ title, body }).show();
      return {
        result: { ok: true, supported },
        resultSummary: supported ? 'notification shown' : 'notification unsupported',
      };
    }
    case 'exportAs': {
      const meta = readMeta(context.artifactId);
      if (!meta) throw new Error('Artifact not found');
      const fp = htmlPath(context.artifactId, context.version);
      const currentHtml = existsSync(fp) ? readFileSync(fp, 'utf-8') : null;
      const exportRequest = resolveArtifactExportRequest(params, meta, currentHtml);
      await requireArtifactBridgeAuthorization(context.artifactId, 'export', detail ?? exportRequest.fileName);
      const saveOptions = {
        defaultPath: exportRequest.fileName,
        filters: exportRequest.filters,
      };
      const mainWindow = getBridgeMainWindow();
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, saveOptions)
        : await dialog.showSaveDialog(saveOptions);
      if (result.canceled || !result.filePath) {
        return {
          result: { ok: false, canceled: true },
          resultSummary: 'export cancelled',
        };
      }
      writeFileSync(result.filePath, exportRequest.content, 'utf-8');
      return {
        result: {
          ok: true,
          filePath: result.filePath,
          bytes: exportRequest.bytes,
          mimeType: exportRequest.mimeType,
          type: exportRequest.type,
        },
        resultSummary: `exported ${exportRequest.bytes} bytes`,
      };
    }
    case 'fetch': {
      const fetchRequest = resolveArtifactBridgeFetchRequest(params);
      await requireArtifactBridgeAuthorization(context.artifactId, 'network.fetch', detail ?? fetchRequest.url);
      const response = await fetch(fetchRequest.url, {
        method: fetchRequest.method,
        headers: fetchRequest.headers,
        body: fetchRequest.body,
      });
      const result = await buildArtifactBridgeFetchResponse(response, fetchRequest.maxBytes);
      return {
        result,
        resultSummary: `network ${result.status} ${result.bytes} bytes${result.truncated ? ' truncated' : ''}`,
      };
    }
    case 'exec':
      return prepareArtifactBridgeExecApproval(context.artifactId, params);
    default:
      throw new ArtifactBridgeUnsupportedError(`Unknown artifact bridge method: ${method}`);
  }
}

export function registerArtifactIpcHandlers(): void {
  ipcMain.handle(ARTIFACT_IPC.OPEN, async (_event, artifactId: string, version: number) => {
    const meta = readMeta(artifactId);
    const target = decideArtifactOpenTarget(meta, version);

    switch (target.kind) {
      case 'html-preview': {
        const win = new BrowserWindow({
          width: 1200,
          height: 900,
          title: meta?.title ?? '产物',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'artifact-preload.js'),
          },
        });
        if (meta?.title) win.setTitle(meta.title);
        artifactPreviewWindows.set(win.webContents.id, { artifactId: target.artifactId, version: target.version });
        win.on('closed', () => {
          artifactPreviewWindows.delete(win.webContents.id);
        });
        win.webContents.setWindowOpenHandler(({ url }) => {
          void shell.openExternal(url);
          return { action: 'deny' };
        });
        win.loadURL(`artifact://${target.artifactId}.v${target.version}`);
        return win.id;
      }
      case 'local-file': {
        const error = await shell.openPath(target.path);
        if (error) throw new Error(error);
        return 0;
      }
      case 'external-url': {
        await shell.openExternal(target.url);
        return 0;
      }
      case 'unavailable':
        throw new Error(target.reason === 'missing-meta' ? 'Artifact not found' : 'Artifact has no file path or URL');
    }
  });

  ipcMain.handle(ARTIFACT_IPC.GET_META, async (_event, artifactId: string) => {
    return readMeta(artifactId);
  });

  ipcMain.handle(ARTIFACT_IPC.GET_HTML, async (_event, artifactId: string, version?: number) => {
    const meta = readMeta(artifactId);
    if (!meta) return null;
    const v = version ?? meta.currentVersion;
    const fp = htmlPath(artifactId, v);
    return existsSync(fp) ? readFileSync(fp, 'utf-8') : null;
  });

  ipcMain.handle(ARTIFACT_IPC.LIST, async () => {
    if (!existsSync(indexPath())) return [];
    return JSON.parse(readFileSync(indexPath(), 'utf-8'));
  });

  ipcMain.handle(ARTIFACT_IPC.SAVE_META, async (_event, artifactId: string, meta: ArtifactMeta) => {
    writeMeta(artifactId, meta);
  });

  ipcMain.handle(ARTIFACT_IPC.SAVE_HTML, async (_event, artifactId: string, version: number, html: string) => {
    const dir = artifactDir(artifactId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(htmlPath(artifactId, version), html);
  });

  ipcMain.handle(
    ARTIFACT_IPC.IMPORT_FILE,
    async (_event, artifactId: string, sourcePath: string, preferredFileName?: string) => {
      const stat = statSync(sourcePath);
      if (!stat.isFile()) throw new Error('Source path is not a file');

      const dir = filesDir(artifactId);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const fileName = sanitizeFileName(preferredFileName || sourcePath);
      const targetPath = path.join(dir, fileName);
      copyFileSync(sourcePath, targetPath);

      return {
        filePath: targetPath,
        fileName,
        fileSize: stat.size,
        mimeType: detectMimeType(fileName),
      };
    },
  );

  ipcMain.handle(ARTIFACT_IPC.READ_IMPORTED_TEXT, async (_event, artifactId: string) => {
    return readImportedArtifactText(artifactId);
  });

  ipcMain.handle(ARTIFACT_IPC.READ_IMPORTED_FILE_FACTS, async (_event, artifactId: string) => {
    return readImportedArtifactFileFacts(artifactId);
  });

  ipcMain.handle(ARTIFACT_IPC.READ_IMPORTED_IMAGE_THUMBNAIL, async (_event, artifactId: string) => {
    return readImportedArtifactImageThumbnail(artifactId);
  });

  ipcMain.handle(ARTIFACT_IPC.UPDATE_INDEX, async (_event, entries: unknown) => {
    const root = artifactsRoot();
    if (!existsSync(root)) mkdirSync(root, { recursive: true });
    writeFileSync(indexPath(), JSON.stringify(entries, null, 2));
  });

  ipcMain.handle(ARTIFACT_IPC.WRITE_SKILL, async (_event, _dummy: string, content: string) => {
    const skillDir = path.join(os.homedir(), '.openclaw', 'workspace', 'skills', 'artifact-generator');
    if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), content);
  });

  ipcMain.handle(ARTIFACT_IPC.REQUEST_AUTH, async (_event, artifactId: string, capability: string, detail: string) => {
    return requestArtifactAuthorization(artifactId, capability, detail);
  });

  ipcMain.handle(ARTIFACT_IPC.BRIDGE_CALL, async (event, payload: ArtifactBridgeCallPayload) => {
    const context = artifactPreviewWindows.get(event.sender.id);
    const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
    if (!context || !senderUrl.startsWith(`artifact://${context.artifactId}.v`)) {
      throw new Error('Artifact Bridge is only available inside Artifact preview windows');
    }

    return handleArtifactBridgeCall(context, payload);
  });
}
