# Workbench Semantic Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Agent-driven semantic mapping so Workbench can read method-compatible repositories without requiring OpenClaw's default directory names.

**Architecture:** Extend `RepositoryBinding` with an optional `workbench` semantic mapping. Add a focused mapping module for prompt construction, response parsing, and path sanitization; then make Workbench snapshot loading prefer semantic slots while preserving the current default-template fallback. `RepositoryGate` provides the Agent mapping flow and confirmation UI, mirroring the existing Knowledge Mapping pattern without writing to the target repository.

**Tech Stack:** Electron IPC repository APIs, React 18, TypeScript, Zustand-backed persistence, Semi Design, Vitest.

---

## File Structure

- Modify: `src/lib/agentic-repository.ts`
  - Add `WorkbenchSemanticMapping`, `WorkbenchSemanticSlots`, and `SemanticSlot` types.
  - Add optional `workbench` to `RepositoryBinding`.
  - Normalize persisted workbench mappings safely.
- Create: `src/lib/repository-workbench-mapping.ts`
  - Build the Agent prompt.
  - Parse `ai-action` mapping responses.
  - Sanitize paths against sampled tree entries.
- Create: `src/__tests__/repository-workbench-mapping.test.ts`
  - Cover prompt, parser, negative responses, and sanitizer behavior.
- Modify: `src/__tests__/agentic-repository.test.ts`
  - Cover binding normalization and persistence of `workbench`.
- Modify: `src/lib/repository-workbench.ts`
  - Add semantic-slot snapshot loading.
  - Keep the default `work/active` style loader as fallback.
- Modify: `src/__tests__/repository-workbench.test.ts`
  - Cover default fallback and semantic mapping reads.
- Modify: `src/components/RepositoryGate.tsx`
  - Add Workbench semantic mapping ActionRun flow and confirmation modal.
- Modify: `src/components/WorkbenchRepositoryPanel.tsx`
  - Render semantic sections when `binding.workbench` exists.
  - Keep existing default-template view when it does not.
- Modify: `src/components/RepositoryWorkbenchKanban.tsx`
  - Build columns from semantic slots where available.
- Modify: locale files under `src/i18n` or the existing locale module discovered during implementation.
  - Add labels for mapping actions, slot names, and error states.

Project rule: do not commit unless the user explicitly asks. Each task ends with a git status checkpoint instead of a commit.

---

### Task 1: Repository Binding Types And Normalization

**Files:**
- Modify: `src/lib/agentic-repository.ts`
- Modify: `src/__tests__/agentic-repository.test.ts`

- [ ] **Step 1: Write failing binding normalization tests**

Add this test inside `describe('agentic repository model', ...)` in `src/__tests__/agentic-repository.test.ts`:

```ts
it('normalizes stored workbench semantic mappings', () => {
  const binding = normalizeRepositoryBinding({
    id: 'repo_inst-1',
    name: 'Repo',
    location: 'desktop-local',
    repoPath: '/repo',
    gatewayInstanceId: 'inst-1',
    status: 'repo_ready',
    workbench: {
      isWorkbenchRepository: true,
      confidence: 'high',
      reason: 'This repository has a work system.',
      mappingSource: 'agent',
      slots: {
        current: {
          label: 'Current',
          paths: ['10-ops/tasks/now.md'],
          kind: 'document',
          confidence: 'high',
          reason: 'Current work file.',
        },
        projects: {
          label: 'Projects',
          paths: ['20-projects'],
          kind: 'directory',
          confidence: 'medium',
          reason: 'Project directory.',
        },
        plans: {
          active: {
            label: 'Active plans',
            paths: ['20-projects/demo/plan.md'],
            kind: 'document',
            confidence: 'medium',
            reason: 'Project plan file.',
          },
        },
      },
    },
  });

  expect(binding?.workbench).toMatchObject({
    isWorkbenchRepository: true,
    confidence: 'high',
    mappingSource: 'agent',
    slots: {
      current: {
        label: 'Current',
        paths: ['10-ops/tasks/now.md'],
        kind: 'document',
        confidence: 'high',
      },
      projects: {
        label: 'Projects',
        paths: ['20-projects'],
        kind: 'directory',
        confidence: 'medium',
      },
      plans: {
        active: {
          label: 'Active plans',
          paths: ['20-projects/demo/plan.md'],
          kind: 'document',
          confidence: 'medium',
        },
      },
    },
  });
});

it('drops unsafe stored workbench paths during normalization', () => {
  const binding = normalizeRepositoryBinding({
    id: 'repo_inst-1',
    repoPath: '/repo',
    gatewayInstanceId: 'inst-1',
    status: 'repo_ready',
    workbench: {
      isWorkbenchRepository: true,
      mappingSource: 'agent',
      slots: {
        current: {
          label: 'Current',
          paths: ['/tmp/now.md', '../secret.md', 'safe/now.md'],
          kind: 'document',
          confidence: 'high',
          reason: 'Mixed paths.',
        },
      },
    },
  });

  expect(binding?.workbench?.slots.current?.paths).toEqual(['safe/now.md']);
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts
```

Expected: FAIL because `workbench` types and normalization do not exist.

- [ ] **Step 3: Add workbench semantic types**

Add these exports to `src/lib/agentic-repository.ts` near the knowledge mapping types:

```ts
export type SemanticSlotKind = 'document' | 'directory' | 'mixed';
export type SemanticConfidence = 'low' | 'medium' | 'high';

export interface SemanticSlot {
  label: string;
  paths: string[];
  kind: SemanticSlotKind;
  confidence: SemanticConfidence;
  reason: string;
}

export interface WorkbenchSemanticSlots {
  inbox?: SemanticSlot;
  current?: SemanticSlot;
  next?: SemanticSlot;
  done?: SemanticSlot;
  projects?: SemanticSlot;
  plans?: {
    active?: SemanticSlot;
    completed?: SemanticSlot;
  };
  runs?: SemanticSlot;
  outputs?: SemanticSlot;
  reviews?: SemanticSlot;
  tools?: SemanticSlot;
  logs?: SemanticSlot;
}

export interface WorkbenchSemanticMapping {
  isWorkbenchRepository: boolean;
  confidence?: SemanticConfidence;
  reason?: string;
  mappingSource: 'agent';
  slots: WorkbenchSemanticSlots;
}
```

Extend `RepositoryBinding`:

```ts
export interface RepositoryBinding {
  id: string;
  name: string;
  location: RepositoryLocation;
  repoPath: string;
  gatewayInstanceId: string;
  defaultAgentId?: string;
  schemaProfile: string;
  paths: RepositoryPaths;
  knowledge: KnowledgeRepositoryMapping;
  workbench?: WorkbenchSemanticMapping;
  status: RepositoryStatus;
}
```

- [ ] **Step 4: Add normalization helpers**

Add these helper functions near `normalizeKnowledgeRepositoryMapping` in `src/lib/agentic-repository.ts`:

```ts
function normalizeWorkbenchSemanticMapping(value: unknown): WorkbenchSemanticMapping | undefined {
  if (!isRecord(value) || value.isWorkbenchRepository !== true) return undefined;
  if (value.mappingSource !== 'agent' || !isRecord(value.slots)) return undefined;
  const slots = normalizeWorkbenchSemanticSlots(value.slots);
  if (Object.keys(slots).length === 0) return undefined;
  return {
    isWorkbenchRepository: true,
    confidence: normalizeSemanticConfidence(value.confidence),
    reason: optionalString(value.reason),
    mappingSource: 'agent',
    slots,
  };
}

function normalizeWorkbenchSemanticSlots(value: Record<string, unknown>): WorkbenchSemanticSlots {
  const plans = isRecord(value.plans) ? {
    active: normalizeSemanticSlot(value.plans.active),
    completed: normalizeSemanticSlot(value.plans.completed),
  } : undefined;
  const normalized: WorkbenchSemanticSlots = {
    inbox: normalizeSemanticSlot(value.inbox),
    current: normalizeSemanticSlot(value.current),
    next: normalizeSemanticSlot(value.next),
    done: normalizeSemanticSlot(value.done),
    projects: normalizeSemanticSlot(value.projects),
    plans: plans && (plans.active || plans.completed) ? plans : undefined,
    runs: normalizeSemanticSlot(value.runs),
    outputs: normalizeSemanticSlot(value.outputs),
    reviews: normalizeSemanticSlot(value.reviews),
    tools: normalizeSemanticSlot(value.tools),
    logs: normalizeSemanticSlot(value.logs),
  };
  return Object.fromEntries(Object.entries(normalized).filter(([, slot]) => Boolean(slot))) as WorkbenchSemanticSlots;
}

function normalizeSemanticSlot(value: unknown): SemanticSlot | undefined {
  if (!isRecord(value)) return undefined;
  const paths = Array.isArray(value.paths)
    ? value.paths.filter((item): item is string => typeof item === 'string' && isSafeRelativeRepositoryPath(item))
    : [];
  if (paths.length === 0) return undefined;
  const kind = value.kind === 'document' || value.kind === 'directory' || value.kind === 'mixed' ? value.kind : 'mixed';
  return {
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim().slice(0, 80) : 'Workbench section',
    paths: paths.slice(0, 20),
    kind,
    confidence: normalizeSemanticConfidence(value.confidence) ?? 'medium',
    reason: typeof value.reason === 'string' && value.reason.trim() ? value.reason.trim().slice(0, 240) : 'Agent semantic mapping.',
  };
}

function normalizeSemanticConfidence(value: unknown): SemanticConfidence | undefined {
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}

function isSafeRelativeRepositoryPath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith('/') && !trimmed.includes('..');
}
```

Then add `workbench: normalizeWorkbenchSemanticMapping(value.workbench),` inside `normalizeRepositoryBinding`.

- [ ] **Step 5: Run the targeted test and verify it passes**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Check worktree state**

Run:

```bash
git status --short
```

Expected: only files from this task plus the existing spec/plan files are changed.

---

### Task 2: Workbench Semantic Mapping Prompt, Parser, And Sanitizer

**Files:**
- Create: `src/lib/repository-workbench-mapping.ts`
- Create: `src/__tests__/repository-workbench-mapping.test.ts`

- [ ] **Step 1: Write failing mapping module tests**

Create `src/__tests__/repository-workbench-mapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchSemanticMappingPrompt,
  parseWorkbenchSemanticMappingResponse,
  sanitizeWorkbenchSemanticMapping,
} from '../lib/repository-workbench-mapping';

describe('repository workbench semantic mapping', () => {
  it('builds an Agent prompt focused on method roles instead of directory names', () => {
    const prompt = buildWorkbenchSemanticMappingPrompt({
      repoPath: '/repo',
      tree: ['AGENTS.md', '10-ops/tasks/now.md', '20-projects/demo/README.md'],
      excerpts: [{ path: 'AGENTS.md', content: '用软件工程的思路管理日常任务、项目和知识库。' }],
    });

    expect(prompt).toContain('Workbench 语义映射助手');
    expect(prompt).toContain('方法论角色');
    expect(prompt).toContain('不要要求用户新增、重命名、迁移或修改任何文件');
    expect(prompt).toContain('isWorkbenchRepository');
    expect(prompt).toContain('current');
    expect(prompt).toContain('projects');
    expect(prompt).toContain('```ai-action');
  });

  it('parses a completed mapping response', () => {
    const parsed = parseWorkbenchSemanticMappingResponse([
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
    ].join('\n'));

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

  it('parses a negative mapping response without a mapping object', () => {
    const parsed = parseWorkbenchSemanticMappingResponse([
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
    ].join('\n'));

    expect(parsed).toEqual({
      isWorkbenchRepository: false,
      confidence: 'low',
      reason: 'Plain code repository.',
    });
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
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
npm test -- src/__tests__/repository-workbench-mapping.test.ts
```

Expected: FAIL because `src/lib/repository-workbench-mapping.ts` does not exist.

- [ ] **Step 3: Implement mapping prompt, parser, and sanitizer**

Create `src/lib/repository-workbench-mapping.ts`:

```ts
import type {
  SemanticConfidence,
  SemanticSlot,
  WorkbenchSemanticMapping,
  WorkbenchSemanticSlots,
} from './agentic-repository';

export interface WorkbenchSemanticMappingResponse {
  isWorkbenchRepository: boolean;
  confidence?: SemanticConfidence;
  reason?: string;
  mapping?: WorkbenchSemanticMapping;
}

export function buildWorkbenchSemanticMappingPrompt(options: {
  repoPath: string;
  tree: string[];
  excerpts: Array<{ path: string; content: string }>;
}): string {
  return [
    '你是 OpenClaw Desktop 的 Workbench 语义映射助手。请识别用户仓库是否体现了“大模型知识库 + 日常事务推进 + 工程方法论”的工作系统。',
    '',
    '判断的是方法论角色，不是固定目录名。不要因为目录不叫 work、plans、runs 就判定失败。',
    '不要要求用户新增、重命名、迁移或修改任何文件。不要输出写入计划，不要调用写入工具。',
    '如果某个语义槽位证据不足，就省略该槽位，不要硬猜。',
    '如果仓库只是普通代码仓库或普通资料堆，没有事务推进和知识沉淀痕迹，返回 isWorkbenchRepository=false。',
    '',
    '需要识别的槽位包括：inbox、current、next、done、projects、plans.active、plans.completed、runs、outputs、reviews、tools、logs。',
    '',
    `仓库路径：${options.repoPath}`,
    '',
    '目录树采样：',
    options.tree.map((item) => `- ${item}`).join('\n') || '- （空）',
    '',
    '文件摘录：',
    options.excerpts.map((item) => [`--- ${item.path} ---`, item.content.slice(0, 4000)].join('\n')).join('\n\n') || '（无）',
    '',
    '请严格输出 ai-action JSON：',
    '```ai-action',
    '{"version":1,"kind":"completed","summary":"已识别工作台语义映射","result":{"isWorkbenchRepository":true,"confidence":"low|medium|high","reason":"...","mapping":{"mappingSource":"agent","slots":{"current":{"label":"...","paths":["..."],"kind":"document|directory|mixed","confidence":"low|medium|high","reason":"..."}}}}}',
    '```',
  ].join('\n');
}

export function parseWorkbenchSemanticMappingResponse(text: string): WorkbenchSemanticMappingResponse | null {
  const blocks = Array.from(text.matchAll(/```ai-action\s*([\s\S]*?)```/gi));
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(blocks[index][1].trim());
      const result = isRecord(parsed.result) ? parsed.result : parsed;
      const confidence = normalizeConfidence(result.confidence);
      const reason = stringValue(result.reason);
      if (result.isWorkbenchRepository !== true) {
        return { isWorkbenchRepository: false, confidence, reason };
      }
      if (!isRecord(result.mapping)) continue;
      const mapping = normalizeMapping(result.mapping, confidence, reason);
      if (!mapping) continue;
      return {
        isWorkbenchRepository: true,
        confidence,
        reason,
        mapping,
      };
    } catch {
      // Try older blocks.
    }
  }
  return null;
}

export function sanitizeWorkbenchSemanticMapping(options: {
  mapping: WorkbenchSemanticMapping;
  tree: string[];
}): WorkbenchSemanticMapping | null {
  const validPaths = buildValidPathSet(options.tree);
  const slots = sanitizeSlots(options.mapping.slots, validPaths);
  if (Object.keys(slots).length === 0) return null;
  return {
    ...options.mapping,
    slots,
  };
}

function normalizeMapping(value: Record<string, unknown>, confidence?: SemanticConfidence, reason?: string): WorkbenchSemanticMapping | null {
  if (value.mappingSource !== 'agent' || !isRecord(value.slots)) return null;
  const slots = normalizeSlots(value.slots);
  if (Object.keys(slots).length === 0) return null;
  return {
    isWorkbenchRepository: true,
    confidence,
    reason,
    mappingSource: 'agent',
    slots,
  };
}

function normalizeSlots(value: Record<string, unknown>): WorkbenchSemanticSlots {
  const plans = isRecord(value.plans) ? {
    active: normalizeSlot(value.plans.active),
    completed: normalizeSlot(value.plans.completed),
  } : undefined;
  const slots: WorkbenchSemanticSlots = {
    inbox: normalizeSlot(value.inbox),
    current: normalizeSlot(value.current),
    next: normalizeSlot(value.next),
    done: normalizeSlot(value.done),
    projects: normalizeSlot(value.projects),
    plans: plans && (plans.active || plans.completed) ? plans : undefined,
    runs: normalizeSlot(value.runs),
    outputs: normalizeSlot(value.outputs),
    reviews: normalizeSlot(value.reviews),
    tools: normalizeSlot(value.tools),
    logs: normalizeSlot(value.logs),
  };
  return Object.fromEntries(Object.entries(slots).filter(([, slot]) => Boolean(slot))) as WorkbenchSemanticSlots;
}

function normalizeSlot(value: unknown): SemanticSlot | undefined {
  if (!isRecord(value) || !Array.isArray(value.paths)) return undefined;
  const paths = value.paths.filter((item): item is string => typeof item === 'string' && isSafeRelativePath(item)).slice(0, 20);
  if (paths.length === 0) return undefined;
  return {
    label: stringValue(value.label)?.slice(0, 80) || 'Workbench section',
    paths,
    kind: value.kind === 'document' || value.kind === 'directory' || value.kind === 'mixed' ? value.kind : 'mixed',
    confidence: normalizeConfidence(value.confidence) ?? 'medium',
    reason: stringValue(value.reason)?.slice(0, 240) || 'Agent semantic mapping.',
  };
}

function sanitizeSlots(slots: WorkbenchSemanticSlots, validPaths: Set<string>): WorkbenchSemanticSlots {
  const plans = slots.plans ? {
    active: sanitizeSlot(slots.plans.active, validPaths),
    completed: sanitizeSlot(slots.plans.completed, validPaths),
  } : undefined;
  const sanitized: WorkbenchSemanticSlots = {
    inbox: sanitizeSlot(slots.inbox, validPaths),
    current: sanitizeSlot(slots.current, validPaths),
    next: sanitizeSlot(slots.next, validPaths),
    done: sanitizeSlot(slots.done, validPaths),
    projects: sanitizeSlot(slots.projects, validPaths),
    plans: plans && (plans.active || plans.completed) ? plans : undefined,
    runs: sanitizeSlot(slots.runs, validPaths),
    outputs: sanitizeSlot(slots.outputs, validPaths),
    reviews: sanitizeSlot(slots.reviews, validPaths),
    tools: sanitizeSlot(slots.tools, validPaths),
    logs: sanitizeSlot(slots.logs, validPaths),
  };
  return Object.fromEntries(Object.entries(sanitized).filter(([, slot]) => Boolean(slot))) as WorkbenchSemanticSlots;
}

function sanitizeSlot(slot: SemanticSlot | undefined, validPaths: Set<string>): SemanticSlot | undefined {
  if (!slot) return undefined;
  const paths = slot.paths.filter((item) => isSafeRelativePath(item) && validPaths.has(normalizeTreePath(item))).slice(0, 20);
  if (paths.length === 0) return undefined;
  return { ...slot, paths };
}

function buildValidPathSet(tree: string[]): Set<string> {
  const values = new Set<string>();
  for (const item of tree) {
    const normalized = normalizeTreePath(item);
    if (normalized) values.add(normalized);
  }
  return values;
}

function normalizeTreePath(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function isSafeRelativePath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith('/') && !trimmed.includes('..');
}

function normalizeConfidence(value: unknown): SemanticConfidence | undefined {
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 4: Run the mapping module tests**

Run:

```bash
npm test -- src/__tests__/repository-workbench-mapping.test.ts
```

Expected: PASS.

- [ ] **Step 5: Check worktree state**

Run:

```bash
git status --short
```

Expected: new mapping module and test file are present.

---

### Task 3: Semantic Workbench Snapshot Loading

**Files:**
- Modify: `src/lib/repository-workbench.ts`
- Modify: `src/__tests__/repository-workbench.test.ts`

- [ ] **Step 1: Add failing semantic snapshot tests**

Append this test to `src/__tests__/repository-workbench.test.ts`:

```ts
it('loads semantic workbench slots when binding has a workbench mapping', async () => {
  const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
    if (directory === '20-projects') return [{ path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 }];
    if (directory === '40-tools') return [{ path: '40-tools/README.md', name: 'README.md', size: 24, updatedAt: 5 }];
    return [];
  });
  const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
    if (relativePath === '10-ops/tasks/now.md') return '# 正在进行\n\n- 当前焦点';
    if (relativePath === '10-ops/tasks/next.md') return '# 接下来\n\n- 后续事项';
    return '';
  });
  vi.stubGlobal('window', {
    electronAPI: {
      repository: { listMarkdown, readText },
    },
  });

  const snapshot = await loadWorkbenchSnapshot({
    ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
    status: 'repo_ready',
    workbench: {
      isWorkbenchRepository: true,
      mappingSource: 'agent',
      confidence: 'high',
      slots: {
        current: {
          label: '正在进行',
          paths: ['10-ops/tasks/now.md'],
          kind: 'document',
          confidence: 'high',
          reason: 'Current work.',
        },
        next: {
          label: '接下来',
          paths: ['10-ops/tasks/next.md'],
          kind: 'document',
          confidence: 'high',
          reason: 'Next work.',
        },
        projects: {
          label: '项目层',
          paths: ['20-projects'],
          kind: 'directory',
          confidence: 'high',
          reason: 'Projects.',
        },
        tools: {
          label: '工具层',
          paths: ['40-tools'],
          kind: 'directory',
          confidence: 'high',
          reason: 'Tools.',
        },
      },
    },
  });

  expect(snapshot.semanticSections).toEqual([
    expect.objectContaining({ key: 'current', title: '正在进行', markdown: '# 正在进行\n\n- 当前焦点' }),
    expect.objectContaining({ key: 'next', title: '接下来', markdown: '# 接下来\n\n- 后续事项' }),
    expect.objectContaining({ key: 'projects', title: '项目层', files: [{ path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 }] }),
    expect.objectContaining({ key: 'tools', title: '工具层', files: [{ path: '40-tools/README.md', name: 'README.md', size: 24, updatedAt: 5 }] }),
  ]);
  expect(readText).toHaveBeenCalledWith('/repo', '10-ops/tasks/now.md');
  expect(listMarkdown).toHaveBeenCalledWith('/repo', '20-projects');
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
npm test -- src/__tests__/repository-workbench.test.ts
```

Expected: FAIL because `semanticSections` does not exist.

- [ ] **Step 3: Extend snapshot types and loader**

In `src/lib/repository-workbench.ts`, add imports:

```ts
import type { RepositoryBinding, SemanticSlot } from './agentic-repository';
```

Extend `WorkbenchSnapshot`:

```ts
export interface WorkbenchSemanticSection {
  key: string;
  title: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  paths: string[];
  files: RepositoryMarkdownFile[];
  markdown: string;
}

export interface WorkbenchSnapshot {
  inboxMarkdown: string;
  activeWork: RepositoryMarkdownFile[];
  completedWork: RepositoryMarkdownFile[];
  somedayWork: RepositoryMarkdownFile[];
  activePlans: RepositoryMarkdownFile[];
  completedPlans: RepositoryMarkdownFile[];
  runsMarkdown: string;
  outputsMarkdown: string;
  reviews: RepositoryMarkdownFile[];
  planMetadata: RepositoryPlanMetadata[];
  reviewGroups: RepositoryReviewGroup[];
  semanticSections: WorkbenchSemanticSection[];
}
```

At the start of `loadWorkbenchSnapshot`, add:

```ts
  if (binding.workbench?.isWorkbenchRepository) {
    return loadSemanticWorkbenchSnapshot(binding);
  }
```

In the existing default return object, add:

```ts
    semanticSections: [],
```

Add these helpers:

```ts
async function loadSemanticWorkbenchSnapshot(binding: RepositoryBinding): Promise<WorkbenchSnapshot> {
  const semanticSections = await loadSemanticSections(binding);
  return {
    inboxMarkdown: semanticSections.find((section) => section.key === 'inbox')?.markdown ?? '',
    activeWork: semanticSections.find((section) => section.key === 'current')?.files ?? [],
    completedWork: semanticSections.find((section) => section.key === 'done')?.files ?? [],
    somedayWork: semanticSections.find((section) => section.key === 'next')?.files ?? [],
    activePlans: semanticSections.find((section) => section.key === 'plans.active')?.files ?? [],
    completedPlans: semanticSections.find((section) => section.key === 'plans.completed')?.files ?? [],
    runsMarkdown: semanticSections.find((section) => section.key === 'runs')?.markdown ?? '',
    outputsMarkdown: semanticSections.find((section) => section.key === 'outputs')?.markdown ?? '',
    reviews: semanticSections.find((section) => section.key === 'reviews')?.files ?? [],
    planMetadata: [],
    reviewGroups: [],
    semanticSections,
  };
}

async function loadSemanticSections(binding: RepositoryBinding): Promise<WorkbenchSemanticSection[]> {
  const slots = binding.workbench?.slots;
  if (!slots) return [];
  const entries: Array<[string, SemanticSlot | undefined]> = [
    ['inbox', slots.inbox],
    ['current', slots.current],
    ['next', slots.next],
    ['done', slots.done],
    ['projects', slots.projects],
    ['plans.active', slots.plans?.active],
    ['plans.completed', slots.plans?.completed],
    ['runs', slots.runs],
    ['outputs', slots.outputs],
    ['reviews', slots.reviews],
    ['tools', slots.tools],
    ['logs', slots.logs],
  ];
  const sections = await Promise.all(entries.map(async ([key, slot]) => slot ? loadSemanticSection(binding, key, slot) : null));
  return sections.filter((section): section is WorkbenchSemanticSection => Boolean(section));
}

async function loadSemanticSection(binding: RepositoryBinding, key: string, slot: SemanticSlot): Promise<WorkbenchSemanticSection> {
  const repository = getWorkbenchReadApi();
  const files: RepositoryMarkdownFile[] = [];
  const markdownParts: string[] = [];
  for (const path of slot.paths) {
    if (path.endsWith('.md')) {
      const content = await repository.readText(binding.repoPath, path);
      markdownParts.push(content);
      files.push({ path, name: path.split('/').pop() ?? path, size: content.length, updatedAt: 0 });
    } else {
      files.push(...await repository.listMarkdown(binding.repoPath, path));
    }
  }
  return {
    key,
    title: slot.label,
    confidence: slot.confidence,
    reason: slot.reason,
    paths: slot.paths,
    files,
    markdown: markdownParts.filter(Boolean).join('\n\n---\n\n'),
  };
}
```

- [ ] **Step 4: Run workbench tests**

Run:

```bash
npm test -- src/__tests__/repository-workbench.test.ts
```

Expected: PASS.

- [ ] **Step 5: Check worktree state**

Run:

```bash
git status --short
```

Expected: repository workbench files and tests are modified.

---

### Task 4: RepositoryGate Agent Mapping Flow

**Files:**
- Modify: `src/components/RepositoryGate.tsx`
- Modify: `src/__tests__/agentic-repository.test.ts`
- Modify: locale files under `src/i18n` or existing locale module.

- [ ] **Step 1: Add static coverage for Workbench mapping UI**

Append this test to `src/__tests__/agentic-repository.test.ts`:

```ts
it('exposes a Workbench semantic mapping flow next to knowledge mapping', () => {
  const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');

  expect(source).toContain('buildWorkbenchSemanticMappingPrompt');
  expect(source).toContain('parseWorkbenchSemanticMappingResponse');
  expect(source).toContain('sanitizeWorkbenchSemanticMapping');
  expect(source).toContain('handleSemanticWorkbenchMapping');
  expect(source).toContain('workbenchMappingReady');
  expect(source).toContain('repositoryGate.workbenchMappingActionTitle');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts
```

Expected: FAIL because Workbench mapping UI is not wired.

- [ ] **Step 3: Import mapping helpers and types**

In `src/components/RepositoryGate.tsx`, update imports:

```ts
import type {
  KnowledgeRepositoryMapping,
  RepositoryBinding,
  RepositoryLocation,
  RepositoryStatus,
  WorkbenchSemanticMapping,
} from '../lib/agentic-repository';
import {
  buildWorkbenchSemanticMappingPrompt,
  parseWorkbenchSemanticMappingResponse,
  sanitizeWorkbenchSemanticMapping,
} from '../lib/repository-workbench-mapping';
```

- [ ] **Step 4: Add safe saving helper**

Add below `saveKnowledgeMapping`:

```ts
  const saveWorkbenchMapping = async (base: RepositoryBinding, mapping: WorkbenchSemanticMapping) => {
    const next: RepositoryBinding = {
      ...base,
      schemaProfile: base.schemaProfile === 'default' ? 'semantic-workbench' : base.schemaProfile,
      workbench: mapping,
    };
    setBinding(next);
    setRepoPath(next.repoPath);
    await saveRepositoryBinding(next);
  };
```

- [ ] **Step 5: Add Agent flow handler**

Add this handler after `handleSemanticKnowledgeMapping`:

```ts
  const handleSemanticWorkbenchMapping = async () => {
    if (!currentInstanceId) return;
    if (!activeClient) {
      Toast.error(t('repositoryGate.mappingNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('repositoryGate.mappingNoAgent'));
      return;
    }
    const path = repoPath.trim() || binding?.repoPath;
    if (!path) {
      Toast.warning(t('repositoryGate.noFolderSelected'));
      return;
    }
    const repository = window.electronAPI?.repository;
    if (!repository?.listTree) {
      Toast.error(t('repositoryGate.localRepositoryUnavailable'));
      return;
    }

    setMappingLoading(true);
    try {
      const base = binding ?? await createAndSaveRepositoryBinding({
        gatewayInstanceId: currentInstanceId,
        repoPath: path,
        location,
      });
      const tree = await repository.listTree(path, 400);
      const excerpts = await readMappingExcerpts(path, tree);
      const run = createAiActionRun({
        type: 'workbench_repository_map',
        sourcePage: 'workbench',
        instanceId: currentInstanceId,
        agentId: agent.id,
        executionMode: 'isolated-session',
        input: t('repositoryGate.workbenchMappingActionInput', { path }),
      });
      await upsertAiActionRun(currentInstanceId, { ...run, status: 'planning', updatedAt: Date.now() });
      const running = await executeAiActionRunWithGateway(activeClient, run, {
        title: t('repositoryGate.workbenchMappingActionTitle'),
        prompt: buildWorkbenchSemanticMappingPrompt({ repoPath: path, tree, excerpts }),
      });
      await upsertAiActionRun(currentInstanceId, running);

      let latest = running;
      for (let index = 0; index < 10; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latest = await syncAiActionRunWithGateway(activeClient, latest);
        await upsertAiActionRun(currentInstanceId, latest);
        if (latest.status === 'done' || latest.status === 'failed' || latest.status === 'cancelled') break;
      }

      const parsed = parseWorkbenchSemanticMappingResponse(latest.lastAssistantResponse ?? '');
      if (!parsed?.isWorkbenchRepository || !parsed.mapping) {
        Toast.error(parsed?.reason || t('repositoryGate.workbenchMappingFailed'));
        return;
      }
      const sanitized = sanitizeWorkbenchSemanticMapping({ mapping: parsed.mapping, tree });
      if (!sanitized) {
        Toast.error(t('repositoryGate.mappingUnsafe'));
        return;
      }

      const slotRows = [
        ['inbox', sanitized.slots.inbox],
        ['current', sanitized.slots.current],
        ['next', sanitized.slots.next],
        ['done', sanitized.slots.done],
        ['projects', sanitized.slots.projects],
        ['plans.active', sanitized.slots.plans?.active],
        ['plans.completed', sanitized.slots.plans?.completed],
        ['runs', sanitized.slots.runs],
        ['outputs', sanitized.slots.outputs],
        ['reviews', sanitized.slots.reviews],
        ['tools', sanitized.slots.tools],
        ['logs', sanitized.slots.logs],
      ] as const;

      Modal.confirm({
        title: t('repositoryGate.workbenchMappingConfirmTitle'),
        content: (
          <Space vertical align="start">
            <Text>{parsed.reason || t('repositoryGate.workbenchMappingConfirmDesc')}</Text>
            {slotRows.map(([key, slot]) => (
              slot ? <Text key={key} size="small">{key}: {slot.paths.join(', ')}</Text> : null
            ))}
          </Space>
        ),
        okText: t('common.save'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          await saveWorkbenchMapping(base, sanitized);
          await inspect({ ...base, workbench: sanitized });
          Toast.success(t('repositoryGate.mappingSaved'));
        },
      });
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('repositoryGate.workbenchMappingFailed'));
    } finally {
      setMappingLoading(false);
    }
  };
```

- [ ] **Step 6: Add ready state and button**

Near `knowledgeMappingReady`, add:

```ts
  const workbenchMappingReady = Boolean(binding?.workbench?.isWorkbenchRepository);
```

Update `ready`:

```ts
  const ready = status === 'repo_ready' || (area === 'knowledge' && knowledgeMappingReady) || (area === 'workbench' && workbenchMappingReady);
```

In the setup action area where knowledge mapping button is rendered, add:

```tsx
{area === 'workbench' && (
  <Button
    icon={<IconBranch />}
    loading={mappingLoading}
    disabled={location !== 'desktop-local'}
    onClick={() => void handleSemanticWorkbenchMapping()}
  >
    {t('repositoryGate.mapWorkbenchSemantically')}
  </Button>
)}
```

- [ ] **Step 7: Add locale strings**

Find the existing locale object with `repositoryGate.mappingActionTitle` and add:

```ts
mapWorkbenchSemantically: '语义识别工作台结构',
workbenchMappingActionTitle: '识别工作台语义映射',
workbenchMappingActionInput: '识别仓库 {{path}} 的工作台语义结构',
workbenchMappingFailed: '未能识别工作台语义结构',
workbenchMappingConfirmTitle: '保存工作台语义映射',
workbenchMappingConfirmDesc: 'OpenClaw 将把以下路径作为工作台语义区域读取，目标仓库不会被修改。',
```

Add English equivalents in the English locale:

```ts
mapWorkbenchSemantically: 'Map Workbench semantically',
workbenchMappingActionTitle: 'Map Workbench semantic structure',
workbenchMappingActionInput: 'Map Workbench semantic structure for {{path}}',
workbenchMappingFailed: 'Could not map Workbench semantic structure',
workbenchMappingConfirmTitle: 'Save Workbench semantic mapping',
workbenchMappingConfirmDesc: 'OpenClaw will read these paths as Workbench semantic sections. The target repository will not be modified.',
```

- [ ] **Step 8: Run targeted tests**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts
```

Expected: PASS.

- [ ] **Step 9: Check worktree state**

Run:

```bash
git status --short
```

Expected: RepositoryGate, locale files, and tests are modified.

---

### Task 5: Semantic Workbench UI Rendering

**Files:**
- Modify: `src/components/WorkbenchRepositoryPanel.tsx`
- Modify: `src/components/RepositoryWorkbenchKanban.tsx`
- Modify: `src/__tests__/repository-workbench.test.ts`

- [ ] **Step 1: Add static coverage for semantic rendering**

Append this test to `src/__tests__/repository-workbench.test.ts`:

```ts
it('renders semantic Workbench sections and keeps default fallback components', () => {
  const panel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
  const kanban = readFileSync('src/components/RepositoryWorkbenchKanban.tsx', 'utf8');

  expect(panel).toContain('renderSemanticView');
  expect(panel).toContain('snapshot?.semanticSections');
  expect(panel).toContain('section.confidence');
  expect(panel).toContain('section.reason');
  expect(kanban).toContain('semanticSections');
  expect(kanban).toContain('current');
  expect(kanban).toContain('next');
  expect(kanban).toContain('done');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/__tests__/repository-workbench.test.ts
```

Expected: FAIL because semantic render functions do not exist.

- [ ] **Step 3: Add semantic rendering to WorkbenchRepositoryPanel**

In `src/components/WorkbenchRepositoryPanel.tsx`, add this function before `renderWorkView`:

```tsx
  const renderSemanticView = () => {
    const sections = snapshot?.semanticSections ?? [];
    if (sections.length === 0) return renderWorkView();
    return (
      <Space vertical align="start" style={{ width: '100%' }} spacing={12}>
        {sections.map((section) => (
          <div key={section.key} style={{ ...sectionStyle, width: '100%' }}>
            <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
              <Space align="center" wrap>
                <Title heading={6} style={{ margin: 0 }}>{section.title}</Title>
                <Tag color={section.confidence === 'high' ? 'green' : section.confidence === 'medium' ? 'blue' : 'orange'}>
                  {section.confidence}
                </Tag>
              </Space>
              <Text type="tertiary" size="small">{section.key}</Text>
            </Space>
            <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 8 }}>{section.reason}</Text>
            {section.markdown && (
              <div style={{ marginBottom: 10 }}>
                <MarkdownView content={section.markdown} />
              </div>
            )}
            {section.files.length > 0 && renderFileList(section.files, t('common.noData'))}
          </div>
        ))}
      </Space>
    );
  };
```

Update `renderActiveView`:

```tsx
  const renderActiveView = () => {
    if (snapshot?.semanticSections && snapshot.semanticSections.length > 0) return renderSemanticView();
    if (activeView === 'plans') return renderPlansView();
    if (activeView === 'activity') return renderActivityView();
    if (activeView === 'reviews') return renderReviewsView();
    return renderWorkView();
  };
```

- [ ] **Step 4: Add semantic columns to RepositoryWorkbenchKanban**

In `src/components/RepositoryWorkbenchKanban.tsx`, update `columns`:

```tsx
  const columns = useMemo<KanbanColumn[]>(() => {
    const semanticSections = snapshot?.semanticSections ?? [];
    if (semanticSections.length > 0) {
      const sectionByKey = new Map(semanticSections.map((section) => [section.key, section]));
      const filesFor = (key: string) => sectionByKey.get(key)?.files ?? [];
      return [
        { key: 'current', title: sectionByKey.get('current')?.title ?? t('workbench.activeWork'), color: 'blue', files: filesFor('current') },
        { key: 'plans', title: sectionByKey.get('plans.active')?.title ?? t('workbench.activePlans'), color: 'orange', files: filesFor('plans.active') },
        { key: 'next', title: sectionByKey.get('next')?.title ?? t('workbench.somedayWork'), color: 'grey', files: filesFor('next') },
        { key: 'done', title: sectionByKey.get('done')?.title ?? t('workbench.completedWork'), color: 'green', files: [...filesFor('done'), ...filesFor('plans.completed')] },
      ];
    }
    return [
      { key: 'active', title: t('workbench.activeWork'), color: 'blue', files: snapshot?.activeWork ?? [] },
      { key: 'plans', title: t('workbench.activePlans'), color: 'orange', files: snapshot?.activePlans ?? [] },
      { key: 'someday', title: t('workbench.somedayWork'), color: 'grey', files: snapshot?.somedayWork ?? [] },
      { key: 'done', title: t('workbench.completedWork'), color: 'green', files: [...(snapshot?.completedWork ?? []), ...(snapshot?.completedPlans ?? [])] },
    ];
  }, [snapshot, t]);
```

- [ ] **Step 5: Run workbench tests**

Run:

```bash
npm test -- src/__tests__/repository-workbench.test.ts
```

Expected: PASS.

- [ ] **Step 6: Check worktree state**

Run:

```bash
git status --short
```

Expected: UI files and workbench tests are modified.

---

### Task 6: Full Verification

**Files:**
- Read all changed files.
- No new production files beyond those listed above.

- [ ] **Step 1: Run mapping-related tests**

Run:

```bash
npm test -- src/__tests__/repository-workbench-mapping.test.ts src/__tests__/repository-workbench.test.ts src/__tests__/agentic-repository.test.ts src/__tests__/repository-knowledge.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS and Vite build completes.

- [ ] **Step 5: Runtime verification through Electron CDP**

If an Electron dev instance is already running with CDP, create a temporary script under `/tmp/openclaw-workbench-semantic-check.mjs` and connect to the existing browser:

```js
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const contexts = browser.contexts();
const pages = contexts.flatMap((context) => context.pages());
const page = pages.find((item) => item.url().includes('localhost') || item.url().includes('127.0.0.1')) ?? pages[0];
await page.goto(page.url().split('#')[0] + '#/workbench');
await page.waitForTimeout(1000);
const text = await page.locator('body').innerText();
console.log(text.slice(0, 2000));
await browser.close();
```

Run:

```bash
node /tmp/openclaw-workbench-semantic-check.mjs
```

Expected: output includes Workbench page text and no runtime error. If no CDP instance is running, record that runtime verification was not available and rely on tests, typecheck, and build.

- [ ] **Step 6: Final worktree review**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files match this plan. Do not commit unless the user explicitly asks.
