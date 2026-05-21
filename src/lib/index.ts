export type {
  InstanceConfig,
  ConnectionStatus,
  ConnectionState,
  DiscoveredInstance,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  GatewayError,
  HelloOk,
  ChatEventPayload,
  GatewayClientOptions,
} from './types';
export { useStore } from './store';
export { createGatewayClient } from './gateway';
export type { GatewayClient } from './gateway';
