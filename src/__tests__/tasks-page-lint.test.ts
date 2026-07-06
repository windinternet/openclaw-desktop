import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TasksPage lint guardrails', () => {
  it('keeps task edit callback dependencies limited to referenced drafts', () => {
    const source = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const handleEdit = source.match(/const handleEdit = useCallback\([\s\S]*?\n {2}\]\);/)?.[0];

    expect(handleEdit).toBeTruthy();
    expect(handleEdit).toContain('promptDraft');
    expect(handleEdit).toContain('scheduleDraft');
    expect(handleEdit).toContain('agentIdDraft');
    expect(handleEdit).not.toContain('titleDraft');
  });

  it('keeps form select callbacks and visible session rendering typed', () => {
    const source = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const formFields = source.match(/const cronFormFields = \(isEdit: boolean\) => \([\s\S]*?\n {2}\);/)?.[0] ?? '';

    expect(formFields).toContain('onChange={(v: unknown) => setAgentIdDraft(stringValueOrUndefined(v))}');
    expect(formFields).toContain('onChange={(v: unknown) => setDeliveryModeDraft(stringValueOrFallback(v,');
    expect(formFields).toContain('onChange={(v: unknown) => setDeliveryToDraft(stringValueOrFallback(v,');
    expect(formFields).toMatch(/sessions\s*\.filter\(\(s\) => s\.key \|\| s\.sessionKey\)\s*\.map\(\(s\) => \(/);
    expect(formFields).not.toContain(': any');
  });

  it('uses CronJob types for create and update payloads', () => {
    const source = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const handleAdd = source.match(/const handleAdd = useCallback\([\s\S]*?\n {2}\]\);/)?.[0] ?? '';
    const handleEdit = source.match(/const handleEdit = useCallback\([\s\S]*?\n {2}\]\);/)?.[0] ?? '';

    expect(handleAdd).toContain("const job: Omit<CronJob, 'id'> = {");
    expect(handleEdit).toContain('const updates: Partial<CronJob> = {');
    expect(handleEdit).toContain('await updateCronJob(editJob.id, updates);');
    expect(handleAdd).not.toContain(': any');
    expect(handleEdit).not.toContain('as any');
  });

  it('types the Semi form api ref used by magic fill', () => {
    const source = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const addFormBlock = source.match(/<Form\n {10}getFormApi=\{\(api:[\s\S]*?\n {10}labelPosition="top"/)?.[0] ?? '';

    expect(source).toContain('interface TasksFormApi {');
    expect(source).toContain('setValues: (values: Record<string, unknown>) => void;');
    expect(source).toContain('const realApiRef = useRef<TasksFormApi | null>(null);');
    expect(addFormBlock).toContain('getFormApi={(api: TasksFormApi) => {');
    expect(addFormBlock).not.toContain('any');
  });

  it('narrows parsed magic fill JSON before reading result fields', () => {
    const source = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const parseBlock = source.match(/\/\/ Parse[\s\S]*?if \(!obj\)/)?.[0] ?? '';

    expect(source).toContain('function recordFromMagicFillValue(value: unknown): Record<string, unknown> | null');
    expect(parseBlock).toContain('let obj: Record<string, unknown> | null = null;');
    expect(parseBlock).toContain('const parsed = JSON.parse(blocks[i][1].trim()) as unknown;');
    expect(parseBlock).toContain('obj = recordFromMagicFillValue(parsed);');
    expect(parseBlock).not.toContain('let obj: any');
  });

  it('uses the Semi table expand callback type without casting the handler', () => {
    const source = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const handleExpand = source.match(/const handleExpand = useCallback<[\s\S]*?\n {2}\);/)?.[0] ?? '';

    expect(source).toContain("import type { OnExpand } from '@douyinfe/semi-ui/lib/es/table/interface';");
    expect(handleExpand).toContain('useCallback<OnExpand<CronJob>>');
    expect(handleExpand).toContain('if (!record) {');
    expect(source).toContain('onExpand={handleExpand}');
    expect(source).not.toContain('onExpand={handleExpand as any}');
  });

  it('keeps magic fill parse failures user-facing without direct console logging', () => {
    const source = readFileSync('src/pages/TasksPage.tsx', 'utf8');
    const parseErrorBlock =
      source.match(/Toast\.success\(t\('tasks\.contentFilled'\)\);[\s\S]*?setMagicLoading\(false\);/)?.[0] ?? '';

    expect(parseErrorBlock).toContain('} catch {');
    expect(parseErrorBlock).toContain("Toast.error(t('tasks.parseError'));");
    expect(parseErrorBlock).not.toContain('console.error');
  });
});
