import type { ArtifactMeta } from './artifact-types';
import type { RepositoryBinding } from './agentic-repository';
import { loadRepositoryBinding } from './agentic-repository-store';

export interface CreateRepositoryOutputParams {
  binding: RepositoryBinding;
  artifact: ArtifactMeta;
  html?: string;
}

export interface RepositoryOutputResult {
  outputId: string;
  outputPath: string;
  previewPath?: string;
}

export type ArtifactRepositoryOutputUpdates = Pick<ArtifactMeta, 'repositoryOutputPath' | 'repositoryPreviewPath'>;

const TYPE_DIR: Record<string, string> = {
  report: 'reports',
  dashboard: 'dashboards',
  document: 'documents',
  slide: 'slides',
  image: 'media',
  video: 'media',
  audio: 'media',
  link: 'links',
};

export function buildOutputMarkdown(artifact: ArtifactMeta, previewPath?: string): string {
  return [
    `# ${artifact.title}`,
    '',
    `artifactId: ${artifact.id}`,
    `type: ${artifact.type}`,
    `status: ${artifact.status}`,
    `version: ${artifact.currentVersion}`,
    `updatedAt: ${new Date(artifact.updatedAt).toISOString()}`,
    `sourceType: ${artifact.source.type}`,
    artifact.source.id ? `sourceId: ${artifact.source.id}` : undefined,
    artifact.source.name ? `sourceName: ${artifact.source.name}` : undefined,
    artifact.htmlAudit ? `htmlSelfContained: ${artifact.htmlAudit.selfContained}` : undefined,
    artifact.htmlAudit ? `htmlRequiresApproval: ${artifact.htmlAudit.requiresApproval}` : undefined,
    artifact.htmlAudit ? `htmlIssueCount: ${artifact.htmlAudit.issues.length}` : undefined,
    previewPath ? `preview: ${previewPath}` : undefined,
    artifact.description ? `description: ${artifact.description}` : undefined,
    artifact.tags.length > 0 ? `tags: ${artifact.tags.join(', ')}` : undefined,
    '',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

export async function createRepositoryOutput(params: CreateRepositoryOutputParams): Promise<RepositoryOutputResult> {
  const repository = getRepositoryWriteApi();
  const bucket = TYPE_DIR[params.artifact.type] ?? 'html';
  const outputPath = `${params.binding.paths.outputs}/${bucket}/${params.artifact.id}.md`;
  const previewPath = params.html ? `${params.binding.paths.outputs}/html/${params.artifact.id}.html` : undefined;

  if (previewPath && params.html) {
    await repository.writeText(params.binding.repoPath, previewPath, params.html);
  }

  await repository.writeText(params.binding.repoPath, outputPath, buildOutputMarkdown(params.artifact, previewPath));

  const indexPath = `${params.binding.paths.outputs}/index.md`;
  const existingIndex = await repository.readText(params.binding.repoPath, indexPath);
  const indexEntry = `- [${params.artifact.title}](${outputPath})`;
  const nextIndex = existingIndex.includes(outputPath) ? existingIndex : `${existingIndex.trimEnd()}\n${indexEntry}\n`;
  await repository.writeText(params.binding.repoPath, indexPath, nextIndex);

  return { outputId: params.artifact.id, outputPath, previewPath };
}

export function buildArtifactRepositoryOutputUpdates(output: RepositoryOutputResult): ArtifactRepositoryOutputUpdates {
  return {
    repositoryOutputPath: output.outputPath,
    repositoryPreviewPath: output.previewPath,
  };
}

export async function mirrorArtifactToReadyRepositoryOutput(
  instanceId: string,
  artifact: ArtifactMeta,
  html?: string,
): Promise<RepositoryOutputResult | null> {
  const binding = await loadRepositoryBinding(instanceId);
  if (!binding || binding.status !== 'repo_ready' || binding.location !== 'desktop-local') return null;

  return createRepositoryOutput({
    binding,
    artifact,
    html,
  });
}

function getRepositoryWriteApi() {
  const repository = (globalThis as { window?: Window }).window?.electronAPI?.repository;
  if (!repository?.writeText || !repository.readText) {
    throw new Error('electronAPI.repository output methods not available');
  }
  return {
    writeText: repository.writeText,
    readText: repository.readText,
  };
}
