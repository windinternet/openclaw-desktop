import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact ActionRun linkage', () => {
  it('saves AI-created artifacts as ActionRun outputs and records artifact ids on the run', () => {
    const source = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const store = readFileSync('src/lib/ai-action-run-store.ts', 'utf8');

    expect(source).toContain("source: { type: 'action_run'");
    expect(source).toContain('artifactIds');
    expect(source).toContain('upsertAiActionRun(currentInstanceId');
    expect(store).toContain('parseArtifactsFromText');
    expect(store).toContain('saveArtifactFromChat(parsed,');
    expect(store).toContain('artifactIds');
  });

  it('carries the selected work item into workbench-created artifact ActionRuns', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const workbench = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');

    expect(drawer).toContain('sourcePage?: string');
    expect(drawer).toContain('workItemId?: string');
    expect(drawer).toContain('workItemPath?: string');
    expect(drawer).toContain("sourcePage = 'artifacts'");
    expect(drawer).toContain('workItemId,');
    expect(drawer).toContain('workItemPath,');

    expect(workbench).toContain("import { ArtifactAICreateDrawer } from './ArtifactAICreateDrawer'");
    expect(workbench).toContain('isWorkbenchMatterPath(selectedPreviewPath)');
    expect(workbench).toContain('extractWorkbenchMatterId(selectedPreviewContent)');
    expect(workbench).toContain("t('workbench.createArtifactForMatter')");
    expect(workbench).toContain('sourcePage="workbench"');
    expect(workbench).toContain('workItemId={selectedWorkItemId}');
    expect(workbench).toContain('workItemPath={selectedWorkItemPath}');
  });

  it('prefills the artifact creation prompt when opened from a Dashboard output tail action', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const artifacts = readFileSync('src/pages/ArtifactsPage.tsx', 'utf8');

    expect(drawer).toContain('initialInput?: string');
    expect(drawer).toContain("useState(initialInput ?? '')");
    expect(drawer).toContain('if (visible && initialInput !== undefined) setInput(initialInput)');
    expect(artifacts).toContain('artifactTailActionInitialInput');
    expect(artifacts).toContain('请根据来源事项');
    expect(artifacts).toContain('initialInput={artifactTailActionInitialInput}');
  });
});
