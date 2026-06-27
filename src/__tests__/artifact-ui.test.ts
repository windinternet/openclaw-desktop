import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact UI metadata', () => {
  it('surfaces repository output metadata in artifact list and detail pages', () => {
    const listPage = readFileSync('src/pages/ArtifactsPage.tsx', 'utf8');
    const detailPage = readFileSync('src/pages/ArtifactDetailPage.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(listPage).toContain('repositoryOutputPath');
    expect(listPage).toContain("t('artifact.repositoryOutput')");
    expect(detailPage).toContain('repositoryOutputPath');
    expect(detailPage).toContain('repositoryPreviewPath');
    expect(detailPage).toContain("t('artifact.repositoryPreview')");
    expect(listPage).toContain('htmlAudit');
    expect(listPage).toContain("t('artifact.htmlApprovalRequired')");
    expect(detailPage).toContain("t('artifact.htmlAudit')");
    expect(detailPage).toContain("t('artifact.htmlSelfContained')");
    expect(detailPage).toContain('originalFilePath');
    expect(detailPage).toContain("t('artifact.originalFilePath')");
    expect(detailPage).toContain("t('artifact.fileSize')");
    expect(zh.artifact.repositoryOutput).toBeTruthy();
    expect(zh.artifact.repositoryPreview).toBeTruthy();
    expect(zh.artifact.htmlAudit).toBeTruthy();
    expect(zh.artifact.htmlApprovalRequired).toBeTruthy();
    expect(zh.artifact.originalFilePath).toBeTruthy();
    expect(zh.artifact.fileSize).toBeTruthy();
    expect(en.artifact.repositoryOutput).toBeTruthy();
    expect(en.artifact.repositoryPreview).toBeTruthy();
    expect(en.artifact.htmlAudit).toBeTruthy();
    expect(en.artifact.htmlApprovalRequired).toBeTruthy();
    expect(en.artifact.originalFilePath).toBeTruthy();
    expect(en.artifact.fileSize).toBeTruthy();
  });
});
