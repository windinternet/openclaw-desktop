import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchSemanticMappingPrompt,
  isSafeSemanticSlotPath,
  parseWorkbenchSemanticMappingResponse,
  sanitizeWorkbenchSemanticMapping,
} from '../lib/repository-workbench-mapping';

describe('repository workbench semantic mapping', () => {
  it('keeps the Workbench mapping prompt in a packaged markdown template', () => {
    const template = readFileSync('src/prompts/repository/workbench-semantic-mapping.md', 'utf8');
    const source = readFileSync('src/lib/repository-workbench-mapping.ts', 'utf8');

    expect(template).toContain('只读结构识别');
    expect(template).toContain('{{tree}}');
    expect(template).toContain('{{structureSignals}}');
    expect(source).toContain('workbench-semantic-mapping.md?raw');
    expect(source).toContain('renderPromptTemplate');
  });

  it('builds an Agent prompt focused on method roles instead of directory names', () => {
    const prompt = buildWorkbenchSemanticMappingPrompt({
      repoPath: '/repo',
      tree: ['AGENTS.md', '10-ops/tasks/now.md', '20-projects/demo/README.md'],
      structureSignals: [
        { path: '10-ops/tasks/now.md', hints: ['current-work'] },
        { path: '40-tools/templates/task-template.md', hints: ['reusable-tool'] },
      ],
    });

    expect(prompt).toContain('Workbench 语义映射助手');
    expect(prompt).toContain('方法论角色');
    expect(prompt).toContain('项目可视化');
    expect(prompt).toContain('Markdown 是事实源');
    expect(prompt).toContain('项目实体');
    expect(prompt).toContain('项目实体 -> 计划/任务 -> 执行记录 -> 产出/复盘 -> 知识/工具复用');
    expect(prompt).toContain('工程方法论');
    expect(prompt).toContain('日常事务推进');
    expect(prompt).toContain('可复用工具');
    expect(prompt).toContain('只读结构识别');
    expect(prompt).toContain('不要要求用户新增、重命名、迁移或修改任何文件');
    expect(prompt).not.toContain('文件摘录');
    expect(prompt).not.toContain('用软件工程的思路管理日常任务');
    expect(prompt).toContain('isWorkbenchRepository');
    expect(prompt).toContain('current');
    expect(prompt).toContain('projects');
    expect(prompt).toContain('```ai-action');
  });

  it('parses a completed mapping response', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Has work system.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: {
                  label: 'Current',
                  paths: ['10-ops/tasks/now.md'],
                  kind: 'document',
                  confidence: 'high',
                  reason: 'Current work.',
                },
              },
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toEqual({
      isWorkbenchRepository: true,
      confidence: 'high',
      reason: 'Has work system.',
      mapping: {
        isWorkbenchRepository: true,
        confidence: 'high',
        reason: 'Has work system.',
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Current work.',
          },
        },
      },
    });
  });

  it('parses completed mapping from a json fenced block when models ignore the ai-action fence label', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '识别完成。',
        '```json',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          summary: '已识别工作台语义映射',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Has work system.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: createSlot(['10-ops/tasks/now.md']),
              },
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed?.isWorkbenchRepository).toBe(true);
    expect(parsed?.mapping?.slots.current?.paths).toEqual(['10-ops/tasks/now.md']);
  });

  it('parses completed mapping when model output has unescaped quotes inside string values', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        '{"version":1,"kind":"completed","summary":"已识别工作台语义映射","result":{"isWorkbenchRepository":true,"confidence":"high","reason":"ok","mapping":{"mappingSource":"agent","slots":{"current":{"label":"正在做","paths":["10-ops/tasks/now.md"],"kind":"document","confidence":"high","reason":"now.md 是标准工程看板中的"当前任务"文件"}}}}}',
        '```',
      ].join('\n'),
    );

    expect(parsed?.isWorkbenchRepository).toBe(true);
    expect(parsed?.mapping?.slots.current?.reason).toContain('"当前任务"');
  });

  it('parses a negative mapping response without a mapping object', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: false,
            confidence: 'low',
            reason: 'Plain code repository.',
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toEqual({
      isWorkbenchRepository: false,
      confidence: 'low',
      reason: 'Plain code repository.',
    });
  });

  it('does not fall back to older blocks when the latest parsable block has an invalid mapping', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Older valid mapping.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: createSlot(['10-ops/tasks/now.md']),
              },
            },
          },
        }),
        '```',
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'high',
            reason: 'Latest block is structurally invalid.',
            mapping: {
              mappingSource: 'agent',
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toBeNull();
  });

  it('returns null when the latest parsable block omits isWorkbenchRepository', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            confidence: 'low',
            reason: 'Missing repository classification.',
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed).toBeNull();
  });

  it('parses the latest valid block when older ai-action blocks are negative or invalid', () => {
    const parsed = parseWorkbenchSemanticMappingResponse(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: false,
            confidence: 'low',
            reason: 'Older negative result.',
          },
        }),
        '```',
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            isWorkbenchRepository: true,
            confidence: 'medium',
            reason: 'Latest valid result.',
            mapping: {
              mappingSource: 'agent',
              slots: {
                current: createSlot(['20-projects/demo/README.md']),
              },
            },
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(parsed?.isWorkbenchRepository).toBe(true);
    expect(parsed?.reason).toBe('Latest valid result.');
    expect(parsed?.mapping?.slots.current?.paths).toEqual(['20-projects/demo/README.md']);
  });

  it('sanitizes paths against sampled repository tree entries', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        confidence: 'high',
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md', '/bad.md', '../bad.md', 'missing.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Mixed paths.',
          },
          projects: {
            label: 'Projects',
            paths: ['20-projects'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Project folder.',
          },
        },
      },
      tree: ['10-ops/', '10-ops/tasks/', '10-ops/tasks/now.md', '20-projects/'],
    });

    expect(sanitized?.slots.current?.paths).toEqual(['10-ops/tasks/now.md']);
    expect(sanitized?.slots.projects?.paths).toEqual(['20-projects']);
  });

  it('normalizes directory paths returned with trailing slashes', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          inbox: {
            label: 'Inbox',
            paths: ['00-inbox/'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Inbox directory.',
          },
          projects: {
            label: 'Projects',
            paths: ['20-projects/'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Project folder.',
          },
        },
      },
      tree: ['00-inbox/', '00-inbox/README.md', '20-projects/', '20-projects/index.md'],
    });

    expect(sanitized?.slots.inbox?.paths).toEqual(['00-inbox']);
    expect(sanitized?.slots.projects?.paths).toEqual(['20-projects']);
  });

  it('does not preserve unsafe whitespace-wrapped semantic slot paths', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md', ' 10-ops/tasks/now.md '],
            kind: 'document',
            confidence: 'high',
            reason: 'Whitespace variant should not be saved.',
          },
        },
      },
      tree: ['10-ops/tasks/now.md'],
    });

    expect(sanitized?.slots.current?.paths).toEqual(['10-ops/tasks/now.md']);
  });

  it('keeps inferred parent directories from sampled file paths', () => {
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          projects: {
            label: 'Projects',
            paths: ['20-projects'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Parent project directory.',
          },
        },
      },
      tree: ['20-projects/demo/README.md'],
    });

    expect(sanitized?.slots.projects?.paths).toEqual(['20-projects']);
  });

  it('limits sanitized paths to 120 entries across all slots', () => {
    const paths = Array.from({ length: 130 }, (_, index) => `work/item-${index}.md`);
    const sanitized = sanitizeWorkbenchSemanticMapping({
      mapping: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          inbox: createSlot(paths.slice(0, 20)),
          current: createSlot(paths.slice(20, 40)),
          next: createSlot(paths.slice(40, 60)),
          done: createSlot(paths.slice(60, 80)),
          projects: createSlot(paths.slice(80, 100)),
          plans: {
            active: createSlot(paths.slice(100, 120)),
            completed: createSlot(paths.slice(120, 130)),
          },
        },
      },
      tree: paths,
    });

    const sanitizedPaths = [
      ...(sanitized?.slots.inbox?.paths ?? []),
      ...(sanitized?.slots.current?.paths ?? []),
      ...(sanitized?.slots.next?.paths ?? []),
      ...(sanitized?.slots.done?.paths ?? []),
      ...(sanitized?.slots.projects?.paths ?? []),
      ...(sanitized?.slots.plans?.active?.paths ?? []),
      ...(sanitized?.slots.plans?.completed?.paths ?? []),
    ];

    expect(sanitizedPaths).toHaveLength(120);
    expect(sanitized?.slots.plans?.completed).toBeUndefined();
  });

  it('exports safe semantic slot path checks', () => {
    expect(isSafeSemanticSlotPath('20-projects/demo')).toBe(true);
    expect(isSafeSemanticSlotPath('/20-projects')).toBe(false);
    expect(isSafeSemanticSlotPath('../secret.md')).toBe(false);
    expect(isSafeSemanticSlotPath('.')).toBe(false);
    expect(isSafeSemanticSlotPath('./20-projects')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects/./demo')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects//demo')).toBe(false);
    expect(isSafeSemanticSlotPath(' 20-projects/demo')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects/demo ')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects/\tdemo')).toBe(false);
    expect(isSafeSemanticSlotPath('20-projects\\demo')).toBe(false);
    expect(isSafeSemanticSlotPath('')).toBe(false);
  });
});

function createSlot(paths: string[]) {
  return {
    label: 'Slot',
    paths,
    kind: 'mixed' as const,
    confidence: 'high' as const,
    reason: 'Many paths.',
  };
}
