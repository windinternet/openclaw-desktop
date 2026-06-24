import type { RepositoryBinding } from './agentic-repository';

export interface RepositoryProtocolDocument {
  title: string;
  path: string;
  content: string;
  missing?: boolean;
}

export interface RepositoryPathMapping {
  label: string;
  path: string;
}

export interface RepositoryProtocolSnapshot {
  documents: RepositoryProtocolDocument[];
  pathMappings: RepositoryPathMapping[];
}

const PROTOCOL_DOCUMENTS = [
  { title: 'AGENTS.md', path: 'AGENTS.md' },
  { title: 'BOOTSTRAP.md', path: 'BOOTSTRAP.md' },
  { title: 'work.schema.md', path: 'schemas/work.schema.md' },
  { title: 'wiki.schema.md', path: 'schemas/wiki.schema.md' },
  { title: 'source.schema.md', path: 'schemas/source.schema.md' },
  { title: 'run.schema.md', path: 'schemas/run.schema.md' },
  { title: 'output.schema.md', path: 'schemas/output.schema.md' },
];

const PATH_LABELS: Record<keyof RepositoryBinding['paths'], string> = {
  sources: '资料源',
  wiki: 'Wiki',
  work: '事项',
  plans: '计划',
  runs: '执行记录',
  outputs: '成果',
  reviews: '复盘',
  schemas: '协议',
};

export async function loadRepositoryProtocolSnapshot(binding: RepositoryBinding): Promise<RepositoryProtocolSnapshot> {
  const repository = typeof window !== 'undefined' ? window.electronAPI?.repository : undefined;
  if (!repository?.readText) {
    throw new Error('electronAPI.repository protocol methods not available');
  }
  const readText = repository.readText;

  const documents = await Promise.all(
    PROTOCOL_DOCUMENTS.map(async (document): Promise<RepositoryProtocolDocument> => {
      try {
        return {
          ...document,
          content: await readText(binding.repoPath, document.path),
        };
      } catch {
        return {
          ...document,
          content: '',
          missing: true,
        };
      }
    }),
  );

  return {
    documents,
    pathMappings: Object.entries(binding.paths).map(([key, path]) => ({
      label: PATH_LABELS[key as keyof RepositoryBinding['paths']] ?? key,
      path,
    })),
  };
}
