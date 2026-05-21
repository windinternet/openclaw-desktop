/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    platform: string;
    versions: {
      node: string;
      electron: string;
    };
    discover: {
      scan: () => Promise<{ url: string; name?: string; version?: string }[]>;
    };
    config: {
      getUserDataPath: () => Promise<string>;
    };
  };
}
