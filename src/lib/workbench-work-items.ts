import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RepositoryBinding } from './agentic-repository';
import { loadRepositoryBinding } from './agentic-repository-store';
import { loadWorkbenchSnapshot, readWorkbenchMarkdown } from './repository-workbench';
import { createFirstWorkbenchMatter } from './workbench-first-matter';
import { extractWorkbenchMatterId } from './workbench-matter';

export interface WorkbenchWorkItemOption {
  id?: string;
  name: string;
  path: string;
}

export async function loadWorkbenchWorkItemOptions(options: {
  binding?: RepositoryBinding | null;
  instanceId?: string | null;
}): Promise<WorkbenchWorkItemOption[]> {
  const binding =
    options.binding ??
    (options.instanceId ? await loadRepositoryBinding(options.instanceId).catch(() => undefined) : undefined);
  if (!binding || binding.status !== 'repo_ready') return [];

  const snapshot = await loadWorkbenchSnapshot(binding);
  const files = [...snapshot.activeWork, ...snapshot.somedayWork, ...snapshot.completedWork];
  return Promise.all(
    files.map(async (file) => {
      const markdown = await readWorkbenchMarkdown(binding, file.path);
      return {
        id: extractWorkbenchMatterId(markdown),
        name: file.name,
        path: file.path,
      };
    }),
  );
}

export async function createWorkbenchWorkItemOption(options: {
  binding?: RepositoryBinding | null;
  instanceId?: string | null;
  title: string;
  now?: Date;
}): Promise<WorkbenchWorkItemOption> {
  const binding =
    options.binding ??
    (options.instanceId ? await loadRepositoryBinding(options.instanceId).catch(() => undefined) : undefined);
  if (!binding || binding.status !== 'repo_ready') throw new Error('Repository binding unavailable');

  const matter = await createFirstWorkbenchMatter(binding, options.title, {
    now: options.now,
    source: 'desktop-action-run',
  });
  return {
    id: matter.id,
    name: matter.title,
    path: matter.path,
  };
}

export function useWorkbenchWorkItemOptions(options: {
  binding?: RepositoryBinding | null;
  instanceId?: string | null;
  enabled?: boolean;
}) {
  const enabled = options.enabled ?? true;
  const [items, setItems] = useState<WorkbenchWorkItemOption[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || (!options.binding && !options.instanceId)) {
      setItems([]);
      setSelectedPath('');
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    loadWorkbenchWorkItemOptions({ binding: options.binding, instanceId: options.instanceId })
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        setSelectedPath((current) => (current && next.some((item) => item.path === current) ? current : ''));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, options.binding, options.instanceId]);

  const createWorkItem = useCallback(
    async (title: string) => {
      setCreating(true);
      try {
        const item = await createWorkbenchWorkItemOption({
          binding: options.binding,
          instanceId: options.instanceId,
          title,
        });
        setItems((current) => [item, ...current.filter((existing) => existing.path !== item.path)]);
        setSelectedPath(item.path);
        return item;
      } finally {
        setCreating(false);
      }
    },
    [options.binding, options.instanceId],
  );

  const selectedWorkItem = useMemo(() => items.find((item) => item.path === selectedPath), [items, selectedPath]);
  const selectedWorkItemId = selectedWorkItem?.id;

  return {
    createWorkItem,
    creating,
    loading,
    options: items,
    selectedPath,
    setSelectedPath,
    selectedWorkItem,
    selectedWorkItemId,
  };
}
