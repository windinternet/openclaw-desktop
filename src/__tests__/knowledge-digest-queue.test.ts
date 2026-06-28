import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

describe('knowledge digest queue', () => {
  it('surfaces undigested sources as a first-class Knowledge view', () => {
    const panel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');
    const page = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');
    const repositoryKnowledge = readFileSync('src/lib/repository-knowledge.ts', 'utf8');
    const manual = readFileSync('docs/desktop-manual/knowledge.md', 'utf8');
    const roadmap = readFileSync('docs/design-docs/product-goal-roadmap.md', 'utf8');
    const plans = readFileSync('docs/PLANS.md', 'utf8');
    const selfKnowledge = readFileSync('src/lib/desktop-self-knowledge.ts', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(repositoryKnowledge).toContain('undigestedSources');
    expect(panel).toContain("| 'digest'");
    expect(panel).toContain('snapshot?.undigestedSources');
    expect(panel).toContain("t('knowledge.digestQueue')");
    expect(panel).toContain("t('knowledge.digestThisSource')");
    expect(panel).toContain("handleKnowledgeRewrite('digest-source', file.path)");
    expect(panel).toContain('importKnowledgeTextSource');
    expect(panel).toContain('showImportText');
    expect(panel).toContain('<Modal');
    expect(panel).toContain('TextArea');
    expect(panel).toContain("t('knowledge.importTextSource')");
    expect(panel).toContain('importKnowledgeUrlSource');
    expect(panel).toContain('showImportUrl');
    expect(panel).toContain("t('knowledge.importUrlSource')");
    expect(panel).toContain('importKnowledgeFileSource');
    expect(panel).toContain('fileInputRef');
    expect(panel).toContain('type="file"');
    expect(panel).toContain("t('knowledge.importFileSource')");
    expect(panel).toContain('dragImportActive');
    expect(panel).toContain('handleImportDrop');
    expect(panel).toContain('onDrop={handleImportDrop}');
    expect(panel).toContain("t('knowledge.dropFilesToImport')");
    expect(panel).toContain("setActiveSection('digest')");
    expect(panel).toContain('openDocument(imported.path)');
    expect(page).toContain("section === 'digest'");
    expect(page).toContain('itemKey="digest"');
    expect(getByPath(zh, 'knowledge.digestQueue')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.digestThisSource')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.importTextSource')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.importTextDone')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.importUrlSource')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.importUrlDone')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.importFileSource')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.importFileDone')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.dropFilesToImport')).toBeTruthy();
    expect(getByPath(en, 'knowledge.digestQueue')).toBeTruthy();
    expect(getByPath(en, 'knowledge.digestThisSource')).toBeTruthy();
    expect(getByPath(en, 'knowledge.importTextSource')).toBeTruthy();
    expect(getByPath(en, 'knowledge.importTextDone')).toBeTruthy();
    expect(getByPath(en, 'knowledge.importUrlSource')).toBeTruthy();
    expect(getByPath(en, 'knowledge.importUrlDone')).toBeTruthy();
    expect(getByPath(en, 'knowledge.importFileSource')).toBeTruthy();
    expect(getByPath(en, 'knowledge.importFileDone')).toBeTruthy();
    expect(getByPath(en, 'knowledge.dropFilesToImport')).toBeTruthy();
    expect(manual).toContain('导入文本');
    expect(manual).toContain('sources/imported/');
    expect(manual).toContain('剪藏 URL');
    expect(manual).toContain('导入文件');
    expect(manual).toContain('拖拽导入');
    expect(roadmap).toContain('Knowledge 页面新增“导入文本”入口');
    expect(roadmap).toContain('Knowledge 页面新增“剪藏 URL”入口');
    expect(roadmap).toContain('Knowledge 页面新增“导入文件”入口');
    expect(roadmap).toContain('Knowledge 页面新增“拖拽导入”入口');
    expect(plans).toContain('导入文本入口');
    expect(plans).toContain('剪藏 URL 入口');
    expect(plans).toContain('导入文件入口');
    expect(plans).toContain('拖拽导入');
    expect(selfKnowledge).toContain('import pasted text into `sources/imported/`');
    expect(selfKnowledge).toContain('clip URLs into `sources/imported/`');
    expect(selfKnowledge).toContain('import local text files into `sources/imported/`');
    expect(selfKnowledge).toContain('drop local text files into `sources/imported/`');
  });
});
