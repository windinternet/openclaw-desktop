import type { ArtifactMeta, ArtifactType, ArtifactSource } from './artifact-types';
import { artifactPersistence } from './artifact-persistence';
import { auditArtifactHtml } from './artifact-html-audit';
import { buildArtifactValueSummary, inferArtifactExternalFormat } from './artifact-value-summary';

let _idCounter = 0;

export function generateArtifactId(): string {
  _idCounter++;
  return `art_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${_idCounter.toString(36)}`;
}

export function getDefaultIcon(type: ArtifactType): string {
  const icons: Record<string, string> = {
    report: '\uD83D\uDCCA',
    dashboard: '\uD83D\uDCC8',
    analysis: '\uD83D\uDD0D',
    checklist: '\uD83D\uDCCB',
    code: '\uD83D\uDCBB',
    document: '\uD83D\uDCC4',
    slide: '\uD83D\uDDBD\uFE0F',
    form: '\uD83D\uDCDD',
    other: '\uD83D\uDCE6',
    link: '\uD83D\uDD17',
    app: '\uD83D\uDE80',
    file: '\uD83D\uDCCE',
    audio: '\uD83C\uDFB5',
    image: '\uD83D\uDDBC\uFE0F',
    video: '\uD83C\uDFAC',
  };
  return icons[type] ?? icons.other;
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

export interface GenerateParams {
  title: string;
  type: ArtifactType;
  icon?: string;
  description?: string;
  tags?: string[];
  templateId?: string;
  data?: Record<string, unknown>;
  html?: string;
  source?: ArtifactSource;
  url?: string;
  command?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  externalFormat?: ArtifactMeta['externalFormat'];
  contentSummary?: string;
  importFile?: boolean;
}

export const artifactService = {
  async generate(params: GenerateParams): Promise<ArtifactMeta> {
    const id = generateArtifactId();

    let html: string | null = null;
    const isHtmlType = [
      'report',
      'dashboard',
      'analysis',
      'checklist',
      'code',
      'document',
      'slide',
      'form',
      'other',
    ].includes(params.type);

    if (isHtmlType) {
      if (params.templateId) {
        const template = await loadTemplateContent(params.templateId);
        html = renderTemplate(template, params.data ?? {});
      } else if (params.html) {
        html = params.html;
      } else {
        throw new Error('必须提供 templateId+data 或 html');
      }
    }

    const importedFile =
      params.importFile && params.filePath
        ? await artifactPersistence.importFile(id, params.filePath, params.fileName)
        : undefined;
    const filePath = importedFile?.filePath ?? params.filePath;
    const fileName = importedFile?.fileName ?? params.fileName ?? fileNameFromPath(filePath);
    const fileSize = importedFile?.fileSize ?? params.fileSize;
    const mimeType = importedFile?.mimeType ?? params.mimeType;
    const externalFormat =
      params.externalFormat ??
      inferArtifactExternalFormat({
        type: params.type,
        url: params.url,
        command: params.command,
        filePath,
        fileName,
        fileSize,
        mimeType,
      });
    const contentSummary =
      params.contentSummary ??
      buildArtifactValueSummary({
        type: params.type,
        url: params.url,
        command: params.command,
        filePath,
        fileName,
        fileSize,
        mimeType,
        externalFormat,
      });

    const now = Date.now();
    const meta: ArtifactMeta = {
      id,
      title: params.title,
      description: params.description,
      icon: params.icon ?? getDefaultIcon(params.type),
      type: params.type,
      source: params.source ?? { type: 'mcp_tool' },
      tags: params.tags ?? [],
      templateId: params.templateId,
      currentVersion: 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      url: params.url,
      command: params.command,
      filePath,
      originalFilePath: importedFile ? params.filePath : undefined,
      fileName,
      fileSize,
      mimeType,
      externalFormat,
      contentSummary,
      htmlAudit: html === null ? undefined : auditArtifactHtml(html),
    };

    await artifactPersistence.saveMeta(id, meta);
    if (html !== null) {
      await artifactPersistence.saveHtml(id, 1, html);
    }

    const index = await artifactPersistence.list();
    index.push(meta);
    await artifactPersistence.updateIndex(index);

    return meta;
  },

  async append(artifactId: string, htmlChunk: string): Promise<void> {
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) throw new Error('产物不存在');

    const currentHtml = await artifactPersistence.loadHtml(artifactId, meta.currentVersion);
    const newHtml = (currentHtml ?? '') + htmlChunk;
    const newVersion = meta.currentVersion + 1;

    await artifactPersistence.saveHtml(artifactId, newVersion, newHtml);

    meta.currentVersion = newVersion;
    meta.htmlAudit = auditArtifactHtml(newHtml);
    meta.updatedAt = Date.now();
    await artifactPersistence.saveMeta(artifactId, meta);

    await updateIndexEntry(meta);
  },

  async update(artifactId: string, updates: Partial<ArtifactMeta>): Promise<void> {
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) throw new Error('产物不存在');
    Object.assign(meta, updates, { updatedAt: Date.now() });
    await artifactPersistence.saveMeta(artifactId, meta);
    await updateIndexEntry(meta);
  },

  async list(): Promise<ArtifactMeta[]> {
    return artifactPersistence.list();
  },
};

async function loadTemplateContent(templateId: string): Promise<string> {
  const templates: Record<string, string> = {
    report: getReportTemplate(),
    analysis: getAnalysisTemplate(),
    checklist: getChecklistTemplate(),
  };
  const html = templates[templateId];
  if (!html) throw new Error(`模板不存在: ${templateId}`);
  return html;
}

function fileNameFromPath(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || undefined;
}

async function updateIndexEntry(meta: ArtifactMeta): Promise<void> {
  const index = await artifactPersistence.list();
  const idx = index.findIndex((e) => e.id === meta.id);
  if (idx >= 0) index[idx] = meta;
  else index.push(meta);
  await artifactPersistence.updateIndex(index);
}

function getReportTemplate(): string {
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><title>{{title}}</title>\n<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a2e;background:#f8f9fa;padding:40px;max-width:900px;margin:0 auto}h1{font-size:24px;margin-bottom:8px;color:#16213e}.meta{color:#666;font-size:13px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e0e0e0}.summary{background:#fff;padding:20px;border-radius:8px;margin-bottom:24px;line-height:1.8;border-left:4px solid #4361ee}.body{line-height:1.8}.body h2{font-size:18px;margin:24px 0 12px;color:#16213e}.body p{margin-bottom:12px}.body table{width:100%;border-collapse:collapse;margin:16px 0}.body th,.body td{border:1px solid #e0e0e0;padding:8px 12px;text-align:left}.body th{background:#f0f2f5;font-weight:600}.footer{text-align:center;color:#999;font-size:12px;margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0}</style></head>\n<body><h1>{{title}}</h1><div class="meta">{{date}} \u00B7 {{author}}</div><div class="summary">{{summary}}</div><div class="body">{{content}}</div><div class="footer">{{footer}}</div></body></html>';
}

function getAnalysisTemplate(): string {
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><title>{{title}}</title>\n<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a2e;background:#f8f9fa;padding:40px;max-width:900px;margin:0 auto}h1{font-size:24px;margin-bottom:8px}.meta{color:#666;font-size:13px;margin-bottom:24px}.overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}.card{background:#fff;padding:20px;border-radius:8px;text-align:center}.card .value{font-size:28px;font-weight:700;color:#4361ee}.card .label{font-size:12px;color:#666;margin-top:4px}.body{line-height:1.8}.footer{text-align:center;color:#999;font-size:12px;margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0}</style></head>\n<body><h1>{{title}}</h1><div class="meta">{{date}} \u00B7 {{author}}</div><div class="overview">{{metrics}}</div><div class="body">{{content}}</div><div class="footer">{{footer}}</div></body></html>';
}

function getChecklistTemplate(): string {
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><title>{{title}}</title>\n<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a2e;background:#f8f9fa;padding:40px;max-width:700px;margin:0 auto}h1{font-size:24px;margin-bottom:8px}.meta{color:#666;font-size:13px;margin-bottom:24px}.items{list-style:none}.items li{padding:12px 16px;margin-bottom:8px;background:#fff;border-radius:8px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:background .2s}.items li:hover{background:#f0f2f5}.items li.checked{opacity:.6}.items li.checked .text{text-decoration:line-through}.checkbox{width:20px;height:20px;border:2px solid #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.items li.checked .checkbox{background:#4361ee;border-color:#4361ee}.items li.checked .checkbox::after{content:"\\2713";color:#fff;font-size:12px}.text{flex:1;font-size:15px}.footer{text-align:center;color:#999;font-size:12px;margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0}</style></head>\n<body><h1>{{title}}</h1><div class="meta">{{date}} \u00B7 {{author}}</div><ul class="items" id="items">{{items}}</ul><div class="footer">{{footer}}</div><script>document.querySelectorAll(".items li").forEach(function(li){li.addEventListener("click",function(){li.classList.toggle("checked")})})</script></body></html>';
}
