import type { ArtifactType } from './artifact-types';
import { artifactService } from './artifact-service';
import { artifactPersistence } from './artifact-persistence';

const ARTIFACT_TYPES = new Set<ArtifactType>([
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function tagsValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function artifactTypeValue(value: unknown): ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.has(value as ArtifactType)
    ? value as ArtifactType
    : 'other';
}

function invalidParams(message: string): { ok: false; error: 'invalid-params'; message: string } {
  return { ok: false, error: 'invalid-params', message };
}

export async function handleDesktopNodeCommand(command: string, params: unknown): Promise<unknown> {
  if (!isObject(params)) {
    return invalidParams('params must be an object');
  }

  if (command === 'desktop.artifacts.create') {
    const title = stringValue(params.title);
    const html = stringValue(params.html);
    if (!title) return invalidParams('title is required');
    if (!html) return invalidParams('html is required');

    const artifact = await artifactService.generate({
      title,
      html,
      type: artifactTypeValue(params.type),
      icon: stringValue(params.icon),
      description: stringValue(params.description),
      tags: tagsValue(params.tags),
      source: { type: 'mcp_tool', name: command },
    });

    return {
      ok: true,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        currentVersion: artifact.currentVersion,
      },
    };
  }

  if (command === 'desktop.artifacts.append') {
    const artifactId = stringValue(params.artifactId);
    const htmlChunk = stringValue(params.htmlChunk);
    if (!artifactId) return invalidParams('artifactId is required');
    if (!htmlChunk) return invalidParams('htmlChunk is required');
    await artifactService.append(artifactId, htmlChunk);
    return { ok: true, artifactId };
  }

  if (command === 'desktop.artifacts.update') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    await artifactService.update(artifactId, {
      title: stringValue(params.title),
      description: stringValue(params.description),
      icon: stringValue(params.icon),
      type: params.type === undefined ? undefined : artifactTypeValue(params.type),
      tags: tagsValue(params.tags),
    });
    return { ok: true, artifactId };
  }

  if (command === 'desktop.artifacts.open') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const version = typeof params.version === 'number' ? params.version : undefined;
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) return { ok: false, error: 'not-found', artifactId };
    await artifactPersistence.openWindow(artifactId, version ?? meta.currentVersion);
    return { ok: true, artifactId };
  }

  return { ok: false, error: 'unsupported-command', command };
}
