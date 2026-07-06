import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('gateway client lint boundaries', () => {
  it('routes gateway client diagnostics through the guarded preload log bridge', () => {
    const source = readFileSync('src/lib/gateway.ts', 'utf8');

    expect(source).toContain("typeof window !== 'undefined'");
    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*level/);
    expect(source).toContain('[GatewayClient] createGatewayClient:');
    expect(source).toContain('[GatewayClient] sendConnect:');
    expect(source).toContain('[GatewayClient] handleDeviceChallenge:');
    expect(source).toContain('[GatewayClient] connect response:');
    expect(source).toContain('[GatewayClient] WebSocket opened, waiting for challenge...');
    expect(source).not.toContain('console.');
  });
});
