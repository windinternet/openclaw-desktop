import { createGatewayClient, type GatewayClient } from './gateway';
import { registerArtifactMcpTools } from './artifact-mcp-adapter';
import { handleDesktopNodeCommand } from './desktop-node-commands';
import type { HelloOk, InstanceConfig } from './types';

export const DESKTOP_BRIDGE_CAPABILITIES = [
  'desktop.ai_action',
  'desktop.local_bridge',
  'desktop.mcp_bridge',
  'desktop.artifact',
  'desktop.artifact.generate',
  'desktop.artifact.append',
  'desktop.artifact.update',
];

export const DESKTOP_NODE_CAPS = ['desktop', 'desktop.artifacts', 'desktop.repository', 'desktop.outputs'];

export const DESKTOP_NODE_COMMANDS = [
  'desktop.artifacts.create',
  'desktop.artifacts.describe',
  'desktop.artifacts.open',
  'desktop.artifacts.update',
  'desktop.artifacts.append',
  'desktop.repository.status',
  'desktop.repository.init',
  'desktop.repository.read',
  'desktop.repository.write',
  'desktop.repository.search',
  'desktop.repository.git.status',
  'desktop.repository.git.diff',
  'desktop.repository.git.log',
  'desktop.repository.git.commit',
  'desktop.repository.session-summary.write',
  'desktop.outputs.create',
  'desktop.outputs.open',
  'desktop.outputs.update',
  'desktop.outputs.append',
  'desktop.notify',
];

export const DESKTOP_NODE_PERMISSIONS = {
  'desktop.artifacts': true,
  'desktop.repository': true,
  'desktop.outputs': true,
};

const bridgeClients = new Map<string, GatewayClient>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function registerDesktopNodeCommandHandler(client: GatewayClient): void {
  client.subscribeEvent(async (frame) => {
    if (frame.event !== 'node.invoke.request' || !isRecord(frame.payload)) return;

    const command = typeof frame.payload.command === 'string' ? frame.payload.command : '';
    const params = frame.payload.params;
    const requestId = typeof frame.payload.requestId === 'string' ? frame.payload.requestId : undefined;
    if (!command) return;

    const result = await handleDesktopNodeCommand(command, params);
    if (!requestId) return;

    try {
      await client.request('node.invoke.result', { requestId, result });
    } catch {
      // Gateway may disconnect while a local Desktop command is running.
    }
  });
}

export async function connectDesktopBridgeToGateway(instance: InstanceConfig): Promise<HelloOk> {
  const existingClient = bridgeClients.get(instance.id);
  if (existingClient?.getStatus() === 'connected') {
    return existingClient.connect();
  }

  existingClient?.disconnect();
  const client = createGatewayClient({
    url: instance.gatewayUrl,
    token: instance.token,
    clientId: 'openclaw-tui',
    clientVersion: '0.1.0',
    clientMode: 'node',
    role: 'node',
    scopes: ['node.read', 'node.write'],
    caps: DESKTOP_NODE_CAPS,
    commands: DESKTOP_NODE_COMMANDS,
    permissions: DESKTOP_NODE_PERMISSIONS,
  });
  bridgeClients.set(instance.id, client);

  const hello = await client.connect();
  await registerArtifactMcpTools(client);
  registerDesktopNodeCommandHandler(client);
  return hello;
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
