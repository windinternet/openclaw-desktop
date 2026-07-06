import { describe, expect, it } from 'vitest';
import {
  buildArtifactOutputPreservationPrompt,
  extractActionRunOutputCandidates,
} from '../lib/artifact-output-preservation';

describe('artifact output preservation prompt', () => {
  it('extracts explicit output candidates from an ActionRun result summary', () => {
    const summary = [
      '本次计划执行完成了发布验证。',
      '',
      '## 产物',
      '',
      '- release-report.html - HTML 交互报告',
      '- https://example.com/demo - 演示链接',
      '- outputs/release-checklist.xlsx - Excel 验收表',
      '',
      '## 过程记录',
      '',
      '- 已完成 smoke test',
    ].join('\n');

    expect(extractActionRunOutputCandidates(summary)).toEqual([
      'release-report.html - HTML 交互报告',
      'https://example.com/demo - 演示链接',
      'outputs/release-checklist.xlsx - Excel 验收表',
    ]);
  });

  it('builds an artifact preservation prompt with result summary and candidates', () => {
    const prompt = buildArtifactOutputPreservationPrompt({
      workItemPath: 'work/active/release.md',
      actionRunOutputId: 'action-run-output:run-plan',
      resultSummary: [
        '已形成 release-report.html 和验收表。',
        '',
        '成果:',
        '- release-report.html - HTML 交互报告',
        '- outputs/release-checklist.xlsx - Excel 验收表',
      ].join('\n'),
    });

    expect(prompt).toContain('请根据来源事项 work/active/release.md 和最近执行记录，判断本次执行中值得沉淀的成果。');
    expect(prompt).toContain('来源执行记录 action-run-output:run-plan。');
    expect(prompt).toContain('最近执行结果摘要：');
    expect(prompt).toContain('已形成 release-report.html 和验收表。');
    expect(prompt).toContain('候选成果：');
    expect(prompt).toContain('- release-report.html - HTML 交互报告');
    expect(prompt).toContain('- outputs/release-checklist.xlsx - Excel 验收表');
    expect(prompt).toContain('请在产物说明中保留来源事项、来源执行记录和价值摘要。');
  });

  it('uses the latest assistant response as an additional candidate source', () => {
    const prompt = buildArtifactOutputPreservationPrompt({
      workItemPath: 'work/active/release.md',
      actionRunOutputId: 'action-run-output:run-plan',
      resultSummary: '执行完成，详情见 assistant 回复。',
      assistantResponse: [
        '本次生成了一个可交互 HTML 成果。',
        '<artifact>',
        '{"title":"发布验收仪表盘","type":"dashboard","contentSummary":"HTML 交互仪表盘"}',
        '<!doctype html><html><body>ok</body></html>',
        '</artifact>',
        '',
        '## 输出',
        '- outputs/release-notes.docx - Word 版本发布说明',
      ].join('\n'),
    });

    expect(prompt).toContain('候选成果：');
    expect(prompt).toContain('- 发布验收仪表盘 · dashboard · HTML 交互仪表盘');
    expect(prompt).toContain('- outputs/release-notes.docx - Word 版本发布说明');
  });

  it('uses source asset run markdown as an additional output candidate source', () => {
    const prompt = buildArtifactOutputPreservationPrompt({
      workItemPath: 'work/active/release.md',
      actionRunOutputId: 'asset-run-output:runs/assets/20260629-010203-release.md',
      assetRunPath: 'runs/assets/20260629-010203-release.md',
      assetRunMarkdown: [
        '---',
        'source: desktop-repository-asset-execution',
        'status: succeeded',
        '---',
        '',
        '## 执行结果',
        '',
        '已完成发布资产运行。',
        '',
        '## 输出',
        '',
        '- [资产运行报告](outputs/reports/asset-release-report.html)：HTML 报告',
        '- outputs/files/release-checklist.xlsx - Excel 检查表',
      ].join('\n'),
    });

    expect(prompt).toContain('来源资产运行 runs/assets/20260629-010203-release.md。');
    expect(prompt).toContain('- 资产运行报告 · outputs/reports/asset-release-report.html · HTML 报告');
    expect(prompt).toContain('- outputs/files/release-checklist.xlsx - Excel 检查表');
  });

  it('builds an asset-run-only preservation prompt without guessing a source matter', () => {
    const prompt = buildArtifactOutputPreservationPrompt({
      actionRunOutputId: 'action-run-output:asset-run-card',
      assetRunPath: 'runs/assets/20260629-010203-release.md',
      assetRunMarkdown: [
        '---',
        'source: desktop-repository-asset-execution',
        'status: succeeded',
        '---',
        '',
        '## 输出',
        '',
        '- outputs/reports/asset-only-report.html - HTML 报告',
      ].join('\n'),
    });

    expect(prompt).toContain('请根据来源资产运行和最近执行记录，判断本次执行中值得沉淀的成果。');
    expect(prompt).toContain('来源资产运行 runs/assets/20260629-010203-release.md。');
    expect(prompt).toContain('- outputs/reports/asset-only-report.html - HTML 报告');
    expect(prompt).not.toContain('来源事项 undefined');
  });

  it('normalizes explicit Markdown link output candidates with titles and targets', () => {
    const summary = [
      '执行完成，显式成果如下：',
      '',
      '## 输出',
      '',
      '- [发布验收报告](outputs/reports/release-report.html)：HTML 交互报告',
      '- [演示链接](https://example.com/release-demo) - 可分享 URL',
      '',
      '## 过程记录',
      '',
      '- [内部记录](work/active/release.md) 不是输出候选',
    ].join('\n');

    expect(extractActionRunOutputCandidates(summary)).toEqual([
      '发布验收报告 · outputs/reports/release-report.html · HTML 交互报告',
      '演示链接 · https://example.com/release-demo · 可分享 URL',
    ]);
  });
});
