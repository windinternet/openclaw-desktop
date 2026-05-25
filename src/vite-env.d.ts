/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    platform: string;
    versions: {
      node: string;
      electron: string;
    };
    discover: {
      scan: () => Promise<{ url: string; name?: string; version?: string; host?: string; ip?: string; authMode?: string; token?: string }[]>;
    };
    config: {
      getUserDataPath: () => Promise<string>;
    };
    notifications: {
      show: (params: { title: string; body: string }) => Promise<boolean>;
    };
    marketplace: {
      search: (params: import('./lib/types').SkillMarketplaceSearchParams) => Promise<import('./lib/types').SkillMarketplaceSkill[]>;
    };
    device: {
      signChallenge: (params: { nonce: string; token: string; clientId: string }) => Promise<{
        deviceId: string;
        publicKey: string;
        signature: string;
        signedAt: number;
        nonce: string;
      }>;
    };
    install: {
      run: () => Promise<void>;
    };
  };
}
