import {
  AGENTIC_REPOSITORY_STORAGE_KEY,
  createDefaultRepositoryBinding,
  getRepositoryGateStatus,
  normalizeRepositoryBinding,
  type RepositoryBinding,
  type KnowledgeRepositoryMapping,
  type RepositoryLocation,
  type RepositoryPaths,
  type RepositoryStatus,
} from './agentic-repository';
import { loadInstanceData, saveInstanceDataAwaited } from './local-persistence';
import { createUnavailableGatewayRepositoryCapabilities, type GatewayRepositoryCapabilities } from './repository-remote-capabilities';

export interface RepositoryInspectDetails {
  pathExists?: boolean;
  isDirectory?: boolean;
  isGitRepo?: boolean;
  isEmpty?: boolean;
  hasRequiredTemplate?: boolean;
  permissionDenied?: boolean;
  detectedProfile?: string;
  suggestedPaths?: Partial<RepositoryPaths>;
  suggestedKnowledge?: Partial<KnowledgeRepositoryMapping>;
}

export interface RepositoryInspectResult {
  binding: RepositoryBinding;
  status: RepositoryStatus;
  details: RepositoryInspectDetails;
}

function repositoryBindingStorageKey(location: RepositoryLocation): string {
  return `${AGENTIC_REPOSITORY_STORAGE_KEY}:${location}`;
}

export async function loadRepositoryBinding(
  instanceId: string,
  location?: RepositoryLocation,
): Promise<RepositoryBinding | null> {
  if (location) {
    const stored = await loadInstanceData<unknown>(instanceId, repositoryBindingStorageKey(location));
    const binding = normalizeRepositoryBinding(stored);
    if (binding) return binding;

    const legacy = normalizeRepositoryBinding(await loadInstanceData<unknown>(instanceId, AGENTIC_REPOSITORY_STORAGE_KEY));
    return legacy?.location === location ? legacy : null;
  }

  const stored = await loadInstanceData<unknown>(instanceId, AGENTIC_REPOSITORY_STORAGE_KEY);
  return normalizeRepositoryBinding(stored);
}

export async function saveRepositoryBinding(binding: RepositoryBinding): Promise<void> {
  await saveInstanceDataAwaited(
    binding.gatewayInstanceId,
    repositoryBindingStorageKey(binding.location),
    binding,
  );
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

const defaultGatewayRepositoryCapabilities = createUnavailableGatewayRepositoryCapabilities();

export async function inspectRepositoryBinding(
  binding: RepositoryBinding,
  gatewayCapabilities: GatewayRepositoryCapabilities = defaultGatewayRepositoryCapabilities,
): Promise<RepositoryInspectResult> {
  if (binding.location === 'gateway-local') {
    const remote = await gatewayCapabilities.inspect(binding);
    const status = getRepositoryGateStatus({
      binding,
      gitAvailable: true,
      remoteReachable: remote.remoteReachable,
      hasRequiredTemplate: remote.hasRequiredTemplate,
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
  const adaptedBinding = applyRepositoryInspectionProfile(binding, details);
  const status = getRepositoryGateStatus({
    binding: adaptedBinding,
    gitAvailable,
    ...details,
  });

  return {
    binding: { ...adaptedBinding, status },
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

function applyRepositoryInspectionProfile(
  binding: RepositoryBinding,
  details: RepositoryInspectDetails,
): RepositoryBinding {
  if (!details.detectedProfile && !details.suggestedPaths && !details.suggestedKnowledge) return binding;
  return {
    ...binding,
    schemaProfile: details.detectedProfile || binding.schemaProfile,
    paths: {
      ...binding.paths,
      ...details.suggestedPaths,
    },
    knowledge: {
      ...binding.knowledge,
      ...details.suggestedKnowledge,
    },
  };
}
