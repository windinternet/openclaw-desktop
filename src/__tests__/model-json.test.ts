import { describe, expect, it } from 'vitest';
import { parseModelJsonObject } from '../lib/model-json';

describe('model JSON parsing', () => {
  it('parses valid JSON objects from fenced model output', () => {
    const parsed = parseModelJsonObject([
      '识别完成。',
      '```json',
      '{"kind":"completed","summary":"ok"}',
      '```',
    ].join('\n'));

    expect(parsed).toEqual({ kind: 'completed', summary: 'ok' });
  });

  it('repairs unescaped quotes inside JSON string values', () => {
    const parsed = parseModelJsonObject([
      '```ai-action',
      '{"kind":"completed","summary":"ok","result":{"reason":"now.md 是标准工程看板中的"当前任务"文件"}}',
      '```',
    ].join('\n'));

    expect(parsed).toEqual({
      kind: 'completed',
      summary: 'ok',
      result: {
        reason: 'now.md 是标准工程看板中的"当前任务"文件',
      },
    });
  });

  it('extracts a bare JSON object when the model omits code fences', () => {
    const parsed = parseModelJsonObject('识别完成：{"kind":"completed","summary":"ok"}');

    expect(parsed).toEqual({ kind: 'completed', summary: 'ok' });
  });
});
