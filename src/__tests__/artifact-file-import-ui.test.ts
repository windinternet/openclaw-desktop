import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact file import UI', () => {
  it('requests file import when a manual file artifact has a local file path', () => {
    const dialog = readFileSync('src/components/ArtifactCreateDialog.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(dialog).toContain('importFile: isFileType && Boolean(filePath)');
    expect(dialog).toContain("t('artifact.importFileHint')");
    expect(zh.artifact.importFileHint).toBeTruthy();
    expect(en.artifact.importFileHint).toBeTruthy();
  });
});
