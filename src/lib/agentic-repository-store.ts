import {
  AGENTIC_REPOSITORY_STORAGE_KEY,
  createDefaultRepositoryBinding,
  getRepositoryGateStatus,
  normalizeRepositoryBinding,
  type RepositoryBinding,
  type RepositoryLocation,
  type RepositoryStatus,
} from './agentic-repository';
import { loadInstanceData, saveInstanceDataAwaited } from './local-persistence';

export interface RepositoryInspectDetails {
  pathExists?: boolean;
  isDirectory?: boolean;
  isGitRepo?: boolean;
  isEmpty?: boolean;
  hasRequiredTemplate?: boolean;
  permissionDenied?: boolean;
}

export interface RepositoryInspectResult {
  binding: RepositoryBinding;
  status: RepositoryStatus;
  details: RepositoryInspectDetails;
}

export async function loadRepositoryBinding(instanceId: string): Promise<RepositoryBinding | null> {
  const stored = await loadInstanceData<unknown>(instanceId, AGENTIC_REPOSITORY_STORAGE_KEY);
  return normalizeRepositoryBinding(stored);
}

export async function saveRepositoryBinding(binding: RepositoryBinding): Promise<void> {
  await saveInstanceDataAwaited(binding.gatewayInstanceId, AGENTIC_REPOSITORY_STORAGE_KEY, binding);
}

export async function createAndSaveRepositoryBinding(options: {
  gatewayInstanceId: string;
  repoPath: string;
  location: RepositoryLocation;
  name?: string;
}): Promise<RepositoryBinding> {
  const binding = createDefaultRepositoryBinding(options);
  await saveRepositoryBinding(binding);
  return binding;
}

export async function inspectRepositoryBinding(binding: RepositoryBinding): Promise<RepositoryInspectResult> {
  if (binding.location === 'gateway-local') {
    const status = getRepositoryGateStatus({
      binding,
      gitAvailable: true,
      remoteReachable: false,
    });
    return {
      binding: { ...binding, status },
      status,
      details: {},
    };
  }

  const repository = typeof window !== 'undefined' ? window.electronAPI?.repository : undefined;
  if (!repository) {
    const status = getRepositoryGateStatus({ binding, gitAvailable: false });
    return { binding: { ...binding, status }, status, details: {} };
  }

  const gitAvailable = await repository.checkGit();
  const details = await repository.inspect(binding.repoPath);
  const status = getRepositoryGateStatus({
    binding,
    gitAvailable,
    ...details,
  });

  return {
    binding: { ...binding, status },
    status,
    details,
  };
}

export async function bootstrapRepositoryBinding(binding: RepositoryBinding): Promise<RepositoryInspectResult> {
  const repository = typeof window !== 'undefined' ? window.electronAPI?.repository : undefined;
  if (!repository || binding.location !== 'desktop-local') {
    return inspectRepositoryBinding(binding);
  }

  const details = await repository.bootstrap(binding.repoPath);
  const status = getRepositoryGateStatus({
    binding,
    gitAvailable: true,
    ...details,
  });

  return {
    binding: { ...binding, status },
    status,
    details,
  };
}

