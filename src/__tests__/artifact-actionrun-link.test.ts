import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact ActionRun linkage', () => {
  it('saves AI-created artifacts as ActionRun outputs and records artifact ids on the run', () => {
    const source = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const store = readFileSync('src/lib/ai-action-run-store.ts', 'utf8');
    const preview = readFileSync('src/lib/artifact-ai-create-preview.ts', 'utf8');

    expect(source).toContain('buildArtifactAICreateGenerateParams(candidate, previewRun?.id)');
    expect(preview).toContain("source: { type: 'action_run'");
    expect(source).toContain('artifactIds');
    expect(source).toContain('upsertAiActionRun(currentInstanceId');
    expect(store).toContain('parseArtifactsFromText');
    expect(store).toContain('saveArtifactFromChat(parsed,');
    expect(store).toContain('artifactIds');
  });

  it('asks artifact creation ActionRuns to emit rich artifact blocks when needed', () => {
    const prompt = readFileSync('src/prompts/ai-actions/artifact-create.md', 'utf8');

    expect(prompt).toContain('<artifact>');
    expect(prompt).toContain('externalFormat');
    expect(prompt).toContain('contentSummary');
    expect(prompt).toContain('reuseKind');
    expect(prompt).toContain('HTML 类型必须提供完整、自包含的 HTML 正文');
    expect(prompt).toContain('如果一次生成多个有价值产物');
  });

  it('keeps multiple AI-created artifact candidates selectable before saving', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const preview = readFileSync('src/lib/artifact-ai-create-preview.ts', 'utf8');

    expect(preview).toContain('parseArtifactAICreatePreviews');
    expect(drawer).toContain('const [previews, setPreviews]');
    expect(drawer).toContain('selectedPreviewIndex');
    expect(drawer).toContain('previews.map((candidate, index)');
    expect(drawer).toContain('setSelectedPreviewIndex(index)');
    expect(drawer).toContain('候选');
  });

  it('lets users explicitly select and save multiple AI-created artifact candidates', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const preview = readFileSync('src/lib/artifact-ai-create-preview.ts', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(preview).toContain('selectArtifactAICreatePreviewsForSave');
    expect(drawer).toContain('const [selectedPreviewIndexes, setSelectedPreviewIndexes]');
    expect(drawer).toContain('togglePreviewSelection');
    expect(drawer).toContain('handleSaveSelectedPreviews');
    expect(drawer).toContain('selectArtifactAICreatePreviewsForSave(previews, selectedPreviewIndexes)');
    expect(drawer).toContain('for (const candidate of previewsToSave)');
    expect(drawer).toContain('savedArtifacts.map((artifact) => artifact.id)');
    expect(drawer).toContain('await onSaved?.(artifact)');
    expect(drawer).toContain("t('artifact.aiCreateSaveSelected', { count: previewsToSave.length })");
    expect(drawer).toContain("t('artifact.aiCreateCandidateSelected')");
    expect(zh.artifact.aiCreateSaveSelected).toBeTruthy();
    expect(en.artifact.aiCreateSaveSelected).toBeTruthy();
  });

  it('lets users edit selected AI-created artifact metadata before saving', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const preview = readFileSync('src/lib/artifact-ai-create-preview.ts', 'utf8');

    expect(preview).toContain('normalizeArtifactAICreatePreviewDraft');
    expect(drawer).toContain('updateSelectedPreview');
    expect(drawer).toContain('保存前可编辑');
    expect(drawer).toContain('Input');
    expect(drawer).toContain('Select');
    expect(drawer).toContain('TagInput');
    expect(drawer).toContain('updateSelectedPreview({ title: value })');
    expect(drawer).toContain('updateSelectedPreview({ type: value as ArtifactType })');
    expect(drawer).toContain('updateSelectedPreview({ contentSummary: value })');
  });

  it('lets users edit selected AI-created HTML body before saving', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const preview = readFileSync('src/lib/artifact-ai-create-preview.ts', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(drawer).toContain("t('artifact.aiCreateHtmlBody')");
    expect(drawer).toContain("t('artifact.aiCreateHtmlBodyHint')");
    expect(drawer).toContain('value={preview.html ??');
    expect(drawer).toContain('updateSelectedPreview({ html: value })');
    expect(preview).toContain('html: normalizedPreview.html');
    expect(zh.artifact.aiCreateHtmlBody).toBeTruthy();
    expect(en.artifact.aiCreateHtmlBody).toBeTruthy();
  });

  it('surfaces an HTML audit before saving an AI-created HTML candidate', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(drawer).toContain("import { auditArtifactHtml } from '../lib/artifact-html-audit'");
    expect(drawer).toContain('selectedPreviewHtmlAudit');
    expect(drawer).toContain('const previewHtml = preview?.html');
    expect(drawer).toContain('auditArtifactHtml(previewHtml ??');
    expect(drawer).toContain("t('artifact.aiCreateHtmlAuditTitle')");
    expect(drawer).toContain("t('artifact.aiCreateHtmlAuditHint')");
    expect(drawer).toContain('selectedPreviewHtmlAudit.issues.slice(0, 3)');
    expect(drawer).toContain('artifact.htmlSelfContained');
    expect(drawer).toContain('artifact.htmlApprovalRequired');
    expect(zh.artifact.aiCreateHtmlAuditTitle).toBeTruthy();
    expect(zh.artifact.aiCreateHtmlAuditHint).toBeTruthy();
    expect(en.artifact.aiCreateHtmlAuditTitle).toBeTruthy();
    expect(en.artifact.aiCreateHtmlAuditHint).toBeTruthy();
  });

  it('lets users edit selected AI-created file and link details before saving', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const preview = readFileSync('src/lib/artifact-ai-create-preview.ts', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(drawer).toContain("t('artifact.aiCreateExternalDetails')");
    expect(drawer).toContain("t('artifact.aiCreateUrl')");
    expect(drawer).toContain("t('artifact.aiCreateCommand')");
    expect(drawer).toContain("t('artifact.aiCreateFilePath')");
    expect(drawer).toContain("t('artifact.aiCreateFileName')");
    expect(drawer).toContain("t('artifact.aiCreateMimeType')");
    expect(drawer).toContain("t('artifact.aiCreateFileSize')");
    expect(drawer).toContain("t('artifact.aiCreateImportFile')");
    expect(drawer).toContain('updateSelectedPreview({ url: value })');
    expect(drawer).toContain('updateSelectedPreview({ command: value })');
    expect(drawer).toContain('updateSelectedPreview({ filePath: value })');
    expect(drawer).toContain('updateSelectedPreview({ fileName: value })');
    expect(drawer).toContain('updateSelectedPreview({ mimeType: value })');
    expect(drawer).toContain('parseEditedFileSize(value)');
    expect(preview).toContain('url: trimmedStringValue(preview.url)');
    expect(preview).toContain('filePath: trimmedStringValue(preview.filePath)');
    expect(zh.artifact.aiCreateExternalDetails).toBeTruthy();
    expect(en.artifact.aiCreateExternalDetails).toBeTruthy();
  });

  it('notifies ActionRun observers after saving an AI-created artifact output', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const store = readFileSync('src/lib/store.ts', 'utf8');

    expect(store).toContain('notifyActionRunsChanged: () => void');
    expect(store).toContain('actionRunsVersion: state.actionRunsVersion + 1');
    expect(drawer).toContain('const notifyActionRunsChanged = useStore((s) => s.notifyActionRunsChanged)');
    expect(drawer).toContain('notifyActionRunsChanged();');
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

  it('lets standalone artifact AI creation select a work item before starting ActionRun', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(drawer).toContain('useWorkbenchWorkItemOptions');
    expect(drawer).toContain('selectedWorkItemPath');
    expect(drawer).toContain('selectedWorkItemId');
    expect(drawer).toContain("t('artifact.aiCreateWorkItemPlaceholder')");
    expect(drawer).toContain('workItemId: resolvedWorkItemId');
    expect(drawer).toContain('workItemPath: resolvedWorkItemPath');
    expect(zh.artifact.aiCreateWorkItem).toBeTruthy();
    expect(en.artifact.aiCreateWorkItem).toBeTruthy();
  });

  it('prefills the artifact creation prompt when opened from a Dashboard output tail action', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const artifacts = readFileSync('src/pages/ArtifactsPage.tsx', 'utf8');
    const prompt = readFileSync('src/lib/artifact-output-preservation.ts', 'utf8');

    expect(drawer).toContain('initialInput?: string');
    expect(drawer).toContain("useState(initialInput ?? '')");
    expect(drawer).toContain('if (visible && initialInput !== undefined) setInput(initialInput)');
    expect(artifacts).toContain('artifactTailActionInitialInput');
    expect(artifacts).toContain('buildArtifactOutputPreservationPrompt');
    expect(artifacts).toContain('loadAiActionRuns(currentInstanceId)');
    expect(artifacts).toContain('artifactTailActionRun');
    expect(artifacts).toContain('artifactTailActionRun.id === artifactTailActionRunId');
    expect(artifacts).toContain('artifactTailActionRunAssistantResponse');
    expect(artifacts).toContain('assistantResponse: artifactTailActionRunAssistantResponse');
    expect(prompt).toContain('extractActionRunOutputCandidates');
    expect(prompt).toContain('assistantResponse');
    expect(prompt).toContain('parseArtifactsFromText');
    expect(prompt).toContain('候选成果');
    expect(prompt).toContain('请根据来源事项');
    expect(artifacts).toContain('artifactTailActionRunId');
    expect(prompt).toContain('来源执行记录');
    expect(artifacts).toContain('initialInput={artifactTailActionInitialInput}');
  });

  it('writes back output tail action context after an AI-created artifact is saved', () => {
    const drawer = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const artifacts = readFileSync('src/pages/ArtifactsPage.tsx', 'utf8');

    expect(drawer).toContain('onSaved?: (artifact: ArtifactMeta) => void | Promise<void>');
    expect(drawer).toContain('await onSaved?.(artifact)');
    expect(artifacts).toContain('preserveWorkbenchOutputFromTailAction');
    expect(artifacts).toContain('loadRepositoryBinding(currentInstanceId)');
    expect(artifacts).toContain('tailActionId: artifactTailActionContext.id');
    expect(artifacts).toContain('onSaved={handleArtifactTailActionSaved}');
  });
});
