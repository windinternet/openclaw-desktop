import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditArtifactHtml } from '../lib/artifact-html-audit';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';
import type { ArtifactMeta } from '../lib/artifact-types';

vi.mock('../lib/artifact-persistence', () => ({
  artifactPersistence: {
    saveMeta: vi.fn(),
    saveHtml: vi.fn(),
    loadMeta: vi.fn(),
    loadHtml: vi.fn(),
    list: vi.fn(),
    updateIndex: vi.fn(),
  },
}));

const mockedPersistence = vi.mocked(artifactPersistence);

function createMeta(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: '报告',
    icon: '📊',
    type: 'report',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('artifact HTML audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPersistence.list.mockResolvedValue([]);
    mockedPersistence.updateIndex.mockResolvedValue(undefined);
    mockedPersistence.saveMeta.mockResolvedValue(undefined);
    mockedPersistence.saveHtml.mockResolvedValue(undefined);
  });

  it('marks inline HTML without external dependencies as self-contained', () => {
    const audit = auditArtifactHtml(
      '<!doctype html><html><head><style>body{color:#111}</style></head><body><script>document.body.dataset.ok="1"</script></body></html>',
    );

    expect(audit.selfContained).toBe(true);
    expect(audit.requiresApproval).toBe(false);
    expect(audit.issues).toEqual([]);
  });

  it('flags external dependencies and privileged Desktop bridge usage', () => {
    const audit = auditArtifactHtml(`
      <html>
        <head>
          <script src="https://cdn.example.com/chart.js"></script>
          <link rel="stylesheet" href="//cdn.example.com/style.css">
          <style>@import url("https://fonts.example.com/a.css"); .hero{background:url(https://img.example.com/bg.png)}</style>
        </head>
        <body>
          <img src="https://img.example.com/chart.png">
          <iframe src="https://example.com/embed"></iframe>
          <script>
            fetch('https://api.example.com/data');
            window.artifactBridge.exec('npm test');
            window.artifactBridge.readFile('/tmp/input.txt');
          </script>
        </body>
      </html>
    `);

    expect(audit.selfContained).toBe(false);
    expect(audit.requiresApproval).toBe(true);
    expect(audit.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'external-script',
        'external-stylesheet',
        'external-image',
        'external-frame',
        'external-css-import',
        'external-css-url',
        'direct-network',
        'bridge-shell-exec',
        'bridge-file-read',
      ]),
    );
  });

  it('stores audit metadata when generating an HTML artifact', async () => {
    await artifactService.generate({
      title: '外部依赖报告',
      type: 'report',
      html: '<!doctype html><html><head><script src="https://cdn.example.com/chart.js"></script></head><body>ok</body></html>',
    });

    const savedMeta = mockedPersistence.saveMeta.mock.calls[0][1];
    expect(savedMeta.htmlAudit?.selfContained).toBe(false);
    expect(savedMeta.htmlAudit?.requiresApproval).toBe(false);
    expect(savedMeta.htmlAudit?.issues.map((issue) => issue.code)).toContain('external-script');
  });

  it('recomputes audit metadata when appending HTML', async () => {
    const meta = createMeta({
      htmlAudit: {
        selfContained: true,
        requiresApproval: false,
        issues: [],
        checkedAt: 1,
      },
    });
    mockedPersistence.loadMeta.mockResolvedValue(meta);
    mockedPersistence.loadHtml.mockResolvedValue('<!doctype html><html><body>');
    mockedPersistence.list.mockResolvedValue([meta]);

    await artifactService.append('art_1', '<script>window.artifactBridge.writeFile("/tmp/out.txt","ok")</script>');

    const savedMeta = mockedPersistence.saveMeta.mock.calls[0][1];
    expect(savedMeta.currentVersion).toBe(2);
    expect(savedMeta.htmlAudit?.requiresApproval).toBe(true);
    expect(savedMeta.htmlAudit?.issues.map((issue) => issue.code)).toContain('bridge-file-write');
  });
});
