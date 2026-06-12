import { createGatewayClient, type GatewayClient } from './gateway';
import { registerArtifactMcpTools } from './artifact-mcp-adapter';
import type { HelloOk, InstanceConfig } from './types';

export const DESKTOP_BRIDGE_CAPABILITIES = [
  'desktop.ai_action',
  'desktop.local_bridge',
  'desktop.mcp_bridge',
];

const bridgeClients = new Map<string, GatewayClient>();

export async function connectDesktopBridgeToGateway(instance: InstanceConfig): Promise<HelloOk> {
  const existingClient = bridgeClients.get(instance.id);
  if (existingClient?.getStatus() === 'connected') {
    return existingClient.connect();
  }

  existingClient?.disconnect();
  const client = createGatewayClient({
    url: instance.gatewayUrl,
    token: instance.token,
    clientId: 'openclaw-desktop-node',
    clientVersion: '0.1.0',
    clientMode: 'node',
    role: 'node',
    scopes: ['node.read', 'node.write'],
    capabilities: DESKTOP_BRIDGE_CAPABILITIES,
  });
  bridgeClients.set(instance.id, client);

  registerArtifactMcpTools(client).catch((err) => {
    void err;
  });

  return client.connect();
}

export function disconnectDesktopBridge(instanceId?: string): void {
  if (instanceId) {
    bridgeClients.get(instanceId)?.disconnect();
    bridgeClients.delete(instanceId);
    return;
  }

  for (const client of bridgeClients.values()) {
    client.disconnect();
  }
  bridgeClients.clear();
}
