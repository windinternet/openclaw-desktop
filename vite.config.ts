import { defineConfig, type InlineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

const manualChunkGroups = [
  {
    name: 'vendor-react',
    packages: ['react', 'react-dom', 'react-router-dom', 'react-i18next', 'zustand'],
  },
  {
    name: 'vendor-semi',
    packages: ['@douyinfe/semi-ui', '@douyinfe/semi-icons', '@douyinfe/semi-illustrations'],
  },
  {
    name: 'vendor-office',
    packages: ['three', 'react-virtualized'],
  },
  {
    name: 'vendor-visualization',
    packages: ['@ant-design/charts'],
  },
  {
    name: 'vendor-markdown',
    packages: ['marked'],
  },
];

const appChunkGroups = [
  {
    name: 'app-workbench',
    paths: ['/src/pages/WorkbenchPage.tsx'],
  },
  {
    name: 'app-artifacts',
    paths: ['/src/pages/ArtifactsPage.tsx', '/src/pages/ArtifactDetailPage.tsx'],
  },
  {
    name: 'app-repository',
    paths: ['/src/pages/RepositoryProtocolPage.tsx'],
  },
  {
    name: 'app-office',
    paths: ['/src/pages/Office3DPage.tsx', '/src/components/office/', '/src/lib/office-'],
  },
  {
    name: 'app-work-system',
    paths: [
      '/src/components/Artifact',
      '/src/components/KnowledgeRepositoryPanel.tsx',
      '/src/components/RepositoryGate.tsx',
      '/src/components/RepositoryWorkbenchKanban.tsx',
      '/src/components/WorkbenchRepositoryPanel.tsx',
      '/src/lib/agentic-repository',
      '/src/lib/artifact-',
      '/src/lib/dashboard-tail-action-routing.ts',
      '/src/lib/repository-',
      '/src/lib/workbench-',
    ],
  },
];

function manualChunks(id: string) {
  const normalizedId = id.split('\\').join('/');

  if (!normalizedId.includes('/node_modules/')) {
    const group = appChunkGroups.find(({ paths }) => paths.some((path) => normalizedId.includes(path)));

    return group?.name;
  }

  const group = manualChunkGroups.find(({ packages }) =>
    packages.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`)),
  );

  return group?.name;
}

function removeElectronRollupPlatformOption(): Plugin {
  return {
    name: 'openclaw:remove-electron-rollup-platform-option',
    config(config: InlineConfig) {
      const rollupOptions = config.build?.rollupOptions as
        | (Record<string, unknown> & { platform?: unknown })
        | undefined;

      if (rollupOptions && 'platform' in rollupOptions) {
        delete rollupOptions.platform;
      }
    },
  };
}

function electronViteBuildOptions(): InlineConfig {
  return {
    plugins: [removeElectronRollupPlatformOption()],
  };
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: electronViteBuildOptions(),
      },
      {
        entry: 'electron/preload.ts',
        vite: electronViteBuildOptions(),
        onstart(args) {
          args.reload();
        },
      },
      {
        entry: 'electron/artifact-preload.ts',
        vite: electronViteBuildOptions(),
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2300,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pet: resolve(__dirname, 'pet.html'),
      },
      output: {
        manualChunks,
      },
    },
  },
});
