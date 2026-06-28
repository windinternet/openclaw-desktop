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
});
