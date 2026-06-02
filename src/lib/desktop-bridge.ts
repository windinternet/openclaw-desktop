import { createGatewayClient, type GatewayClient } from './gateway';
import type { HelloOk, InstanceConfig } from './types';

export const DESKTOP_BRIDGE_CAPABILITIES = [
  'desktop.ai_action',
  'desktop.local_bridge',
  'desktop.mcp_bridge',
];

let bridgeClient: GatewayClient | null = null;
let bridgeInstanceId: string | null = null;

export async function connectDesktopBridgeToGateway(instance: InstanceConfig): Promise<HelloOk> {
  if (bridgeClient && bridgeInstanceId === instance.id && bridgeClient.getStatus() === 'connected') {
    return bridgeClient.connect();
  }

  bridgeClient?.disconnect();
  bridgeInstanceId = instance.id;
  bridgeClient = createGatewayClient({
    url: instance.gatewayUrl,
    token: instance.token,
    clientId: 'openclaw-desktop-node',
    clientVersion: '0.1.0',
    clientMode: 'node',
    role: 'node',
    scopes: ['node.read', 'node.write'],
    capabilities: DESKTOP_BRIDGE_CAPABILITIES,
  });

  return bridgeClient.connect();
}

export function disconnectDesktopBridge(): void {
  bridgeClient?.disconnect();
  bridgeClient = null;
  bridgeInstanceId = null;
}
