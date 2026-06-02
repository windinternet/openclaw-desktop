import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { updateJsonFile } from '../../electron/json-file-store';

interface TestDocument {
  settings?: {
    themeMode: string;
  };
  currentInstanceId?: string | null;
}

let tempDir: string | null = null;

describe('json file store', () => {
  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('serializes concurrent updates to the same file without losing fields', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'openclaw-json-store-'));
    const filePath = path.join(tempDir, 'app.json');
    const fallback: TestDocument = {};

    await Promise.all([
      updateJsonFile<TestDocument>(filePath, fallback, (document) => ({
        ...document,
        settings: { themeMode: 'dark' },
      })),
      updateJsonFile<TestDocument>(filePath, fallback, (document) => ({
        ...document,
        currentInstanceId: 'inst-1',
      })),
    ]);

    const saved = JSON.parse(await readFile(filePath, 'utf-8')) as TestDocument;

    expect(saved).toEqual({
      settings: { themeMode: 'dark' },
      currentInstanceId: 'inst-1',
    });
  });
});
