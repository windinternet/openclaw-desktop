import type { ArtifactType } from './artifact-types';
import { artifactService } from './artifact-service';
import { artifactPersistence } from './artifact-persistence';
import { createDefaultRepositoryBinding, getRepositoryGateStatus } from './agentic-repository';
import { createRepositoryOutput } from './repository-outputs';

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
  'link',
  'app',
  'file',
  'audio',
  'image',
  'video',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tagsValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function artifactTypeValue(value: unknown): ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.has(value as ArtifactType)
    ? value as ArtifactType
    : 'other';
}

function invalidParams(message: string): { ok: false; error: 'invalid-params'; message: string } {
  return { ok: false, error: 'invalid-params', message };
}

function repositoryApi() {
  return (globalThis as { window?: Window }).window?.electronAPI?.repository;
}

function slugPathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session';
}

function buildSessionSummaryMarkdown(params: {
  sessionKey: string;
  title?: string;
  summary: string;
  highlights: string[];
  artifacts: string[];
}): string {
  const lines = [
    `# ${params.title || params.sessionKey}`,
    '',
    `sessionKey: ${params.sessionKey}`,
    `updatedAt: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    params.summary,
    '',
  ];

  if (params.highlights.length > 0) {
    lines.push('## Highlights', '');
    for (const highlight of params.highlights) lines.push(`- ${highlight}`);
    lines.push('');
  }

  if (params.artifacts.length > 0) {
    lines.push('## Outputs', '');
    for (const artifact of params.artifacts) lines.push(`- ${artifact}`);
    lines.push('');
  }

  return lines.join('\n');
}

async function mirrorRepositoryOutput(params: {
  repoPath: string;
  gatewayInstanceId?: string;
  artifactId: string;
}) {
  const artifact = await artifactPersistence.loadMeta(params.artifactId);
  if (!artifact) return null;
  const html = await artifactPersistence.loadHtml(params.artifactId, artifact.currentVersion);
  return createRepositoryOutput({
    binding: createDefaultRepositoryBinding({
      gatewayInstanceId: params.gatewayInstanceId ?? 'desktop-node',
      repoPath: params.repoPath,
    }),
    artifact,
    html: html ?? undefined,
  });
}

export async function handleDesktopNodeCommand(command: string, params: unknown): Promise<unknown> {
  if (!isObject(params)) {
    return invalidParams('params must be an object');
  }

  if (command === 'desktop.artifacts.create') {
    const repoPath = stringValue(params.repoPath);
    const title = stringValue(params.title);
    const html = stringValue(params.html);
    const type = artifactTypeValue(params.type);
    if (!title) return invalidParams('title is required');
    const htmlTypes = ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'];
    if (htmlTypes.includes(type) && !html) return invalidParams('html is required');

    const artifact = await artifactService.generate({
      title,
      html,
      type,
      icon: stringValue(params.icon),
      description: stringValue(params.description),
      tags: tagsValue(params.tags),
      source: { type: 'mcp_tool', name: command },
    });

    const result: {
      ok: true;
      artifact: { id: string; title: string; currentVersion: number };
      output?: { outputId: string; path: string; previewPath?: string };
    } = {
      ok: true,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        currentVersion: artifact.currentVersion,
      },
    };
    if (repoPath) {
      const output = await createRepositoryOutput({
        binding: createDefaultRepositoryBinding({
          gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
          repoPath,
        }),
        artifact,
        html,
      });
      result.output = {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      };
    }
    return result;
  }

  if (command === 'desktop.outputs.create') {
    const repoPath = stringValue(params.repoPath);
    const title = stringValue(params.title);
    const html = stringValue(params.html);
    const type = artifactTypeValue(params.type);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!title) return invalidParams('title is required');
    const htmlTypes = ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'];
    if (htmlTypes.includes(type) && !html) return invalidParams('html is required');

    const artifact = await artifactService.generate({
      title,
      html,
      type,
      icon: stringValue(params.icon),
      description: stringValue(params.description),
      tags: tagsValue(params.tags),
      source: { type: 'mcp_tool', name: command },
    });
    const output = await createRepositoryOutput({
      binding: createDefaultRepositoryBinding({
        gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
        repoPath,
      }),
      artifact,
      html,
    });

    return {
      ok: true,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        currentVersion: artifact.currentVersion,
      },
      output: {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      },
    };
  }

  if (command === 'desktop.outputs.open') {
    const artifactId = stringValue(params.artifactId);
    if (!artifactId) return invalidParams('artifactId is required');
    const version = typeof params.version === 'number' ? params.version : undefined;
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) return { ok: false, error: 'not-found', artifactId };
    await artifactPersistence.openWindow(artifactId, version ?? meta.currentVersion);
    return { ok: true, artifactId };
  }

  if (command === 'desktop.outputs.update') {
    const repoPath = stringValue(params.repoPath);
    const artifactId = stringValue(params.artifactId);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!artifactId) return invalidParams('artifactId is required');
    await artifactService.update(artifactId, {
      title: stringValue(params.title),
      description: stringValue(params.description),
      icon: stringValue(params.icon),
      type: params.type === undefined ? undefined : artifactTypeValue(params.type),
      tags: tagsValue(params.tags),
    });
    const output = await mirrorRepositoryOutput({
      repoPath,
      artifactId,
      gatewayInstanceId: stringValue(params.gatewayInstanceId),
    });
    if (!output) return { ok: false, error: 'not-found', artifactId };
    return {
      ok: true,
      artifactId,
      output: {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      },
    };
  }

  if (command === 'desktop.outputs.append') {
    const repoPath = stringValue(params.repoPath);
    const artifactId = stringValue(params.artifactId);
    const htmlChunk = stringValue(params.htmlChunk);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!artifactId) return invalidParams('artifactId is required');
    if (!htmlChunk) return invalidParams('htmlChunk is required');
    await artifactService.append(artifactId, htmlChunk);
    const output = await mirrorRepositoryOutput({
      repoPath,
      artifactId,
      gatewayInstanceId: stringValue(params.gatewayInstanceId),
    });
    if (!output) return { ok: false, error: 'not-found', artifactId };
    return {
      ok: true,
      artifactId,
      output: {
        outputId: output.outputId,
        path: output.outputPath,
        previewPath: output.previewPath,
      },
    };
  }

  if (command === 'desktop.repository.status') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.checkGit || !repository.inspect) return { ok: false, error: 'repository-api-unavailable' };
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: stringValue(params.gatewayInstanceId) ?? 'desktop-node',
      repoPath,
    });
    const gitAvailable = await repository.checkGit();
    const details = await repository.inspect(repoPath);
    const status = getRepositoryGateStatus({ binding, gitAvailable, ...details });
    return { ok: true, status, details };
  }

  if (command === 'desktop.repository.init') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.init) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, details: await repository.init(repoPath) };
  }

  if (command === 'desktop.repository.read') {
    const repoPath = stringValue(params.repoPath);
    const relativePath = stringValue(params.path);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!relativePath) return invalidParams('path is required');
    const repository = repositoryApi();
    if (!repository?.readText) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, path: relativePath, content: await repository.readText(repoPath, relativePath) };
  }

  if (command === 'desktop.repository.write') {
    const repoPath = stringValue(params.repoPath);
    const relativePath = stringValue(params.path);
    const content = typeof params.content === 'string' ? params.content : undefined;
    if (!repoPath) return invalidParams('repoPath is required');
    if (!relativePath) return invalidParams('path is required');
    if (content === undefined) return invalidParams('content is required');
    const repository = repositoryApi();
    if (!repository?.writeText) return { ok: false, error: 'repository-api-unavailable' };
    await repository.writeText(repoPath, relativePath, content);
    return { ok: true, path: relativePath };
  }

  if (command === 'desktop.repository.search') {
    const repoPath = stringValue(params.repoPath);
    const query = stringValue(params.query);
    const directories = Array.isArray(params.directories)
      ? params.directories.filter((item): item is string => typeof item === 'string')
      : ['sources', 'wiki', 'work', 'plans', 'runs', 'outputs', 'reviews'];
    if (!repoPath) return invalidParams('repoPath is required');
    if (!query) return invalidParams('query is required');
    const repository = repositoryApi();
    if (!repository?.search) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, results: await repository.search(repoPath, query, directories) };
  }

  if (command === 'desktop.repository.git.status') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.gitStatus) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, status: await repository.gitStatus(repoPath) };
  }

  if (command === 'desktop.repository.git.diff') {
    const repoPath = stringValue(params.repoPath);
    if (!repoPath) return invalidParams('repoPath is required');
    const repository = repositoryApi();
    if (!repository?.gitDiff) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, diff: await repository.gitDiff(repoPath) };
  }

  if (command === 'desktop.repository.git.log') {
    const repoPath = stringValue(params.repoPath);
    const relativePath = stringValue(params.path);
    const limit = numberValue(params.limit) ?? 12;
    if (!repoPath) return invalidParams('repoPath is required');
    if (!relativePath) return invalidParams('path is required');
    const repository = repositoryApi();
    if (!repository?.gitLog) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, commits: await repository.gitLog(repoPath, relativePath, limit) };
  }

  if (command === 'desktop.repository.git.commit') {
    const repoPath = stringValue(params.repoPath);
    const message = stringValue(params.message);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!message) return invalidParams('message is required');
    const repository = repositoryApi();
    if (!repository?.gitCommit) return { ok: false, error: 'repository-api-unavailable' };
    return { ok: true, commit: await repository.gitCommit(repoPath, message) };
  }

  if (command === 'desktop.repository.session-summary.write') {
    const repoPath = stringValue(params.repoPath);
    const sessionKey = stringValue(params.sessionKey);
    const summary = stringValue(params.summary);
    const title = stringValue(params.title);
    if (!repoPath) return invalidParams('repoPath is required');
    if (!sessionKey) return invalidParams('sessionKey is required');
    if (!summary) return invalidParams('summary is required');
    const repository = repositoryApi();
    if (!repository?.writeText || !repository.readText) return { ok: false, error: 'repository-api-unavailable' };

    const relativePath = `runs/session-summaries/${slugPathSegment(sessionKey)}.md`;
    await repository.writeText(
      repoPath,
      relativePath,
      buildSessionSummaryMarkdown({
        sessionKey,
        title,
        summary,
        highlights: stringArrayValue(params.highlights),
        artifacts: stringArrayValue(params.artifacts),
      }),
    );

    const indexPath = 'runs/session-summaries/index.md';
    const existingIndex = await repository.readText(repoPath, indexPath);
    const indexEntry = `- [${title || sessionKey}](${relativePath})`;
    const nextIndex = existingIndex.includes(relativePath)
      ? existingIndex
      : `${existingIndex.trimEnd()}\n${indexEntry}\n`;
    await repository.writeText(repoPath, indexPath, nextIndex);
    return { ok: true, path: relativePath };
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
