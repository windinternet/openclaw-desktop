import type { RepositoryBinding } from './agentic-repository';

export interface GatewayRepositoryCapabilityStatus {
  remoteReachable: boolean;
  hasRequiredTemplate: boolean;
}

export interface GatewayRepositoryCapabilities {
  inspect(binding: RepositoryBinding): Promise<GatewayRepositoryCapabilityStatus>;
}

export function createUnavailableGatewayRepositoryCapabilities(): GatewayRepositoryCapabilities {
  return {
    async inspect() {
      return {
        remoteReachable: false,
        hasRequiredTemplate: false,
      };
    },
  };
}
