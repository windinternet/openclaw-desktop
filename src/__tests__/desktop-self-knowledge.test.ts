import { describe, expect, it } from 'vitest';
import { OPENCLAW_REPOSITORY_CONTEXT_END, OPENCLAW_REPOSITORY_CONTEXT_START } from '../lib/repository-context';
import {
  DESKTOP_SELF_KNOWLEDGE_SKILL_NAME,
  DESKTOP_SELF_KNOWLEDGE_SKILL_PATH,
  OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END,
  OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START,
  buildDesktopSelfKnowledgeBlock,
  buildDesktopSelfKnowledgePayload,
  buildDesktopSelfKnowledgeSkillContent,
  hashDesktopSelfKnowledgeText,
  removeDesktopSelfKnowledgeBlock,
  upsertDesktopSelfKnowledgeBlock,
} from '../lib/desktop-self-knowledge';

describe('desktop self-knowledge helpers', () => {
  it('builds a Desktop operator skill that preserves the product goal and capability boundaries', () => {
    const skillContent = buildDesktopSelfKnowledgeSkillContent();

    expect(skillContent).toContain('# OpenClaw Desktop Operator');
    expect(skillContent).toContain('在保持自由的情况下，给大家（普通人）带来更加产品化、易用的小龙虾产品（桌面版）');
    expect(skillContent).toContain('不被任何第三方商业生态所绑定');
    expect(skillContent).toContain('AI驱动长期可成长的知识库');
    expect(skillContent).toContain('这是我的终极目标');
    expect(skillContent).toContain(
      'open app -> choose language/theme -> discover or install Gateway -> choose workspace -> enter the first matter or continue temporarily -> open Workbench',
    );
    expect(skillContent).toContain('continue temporarily, create the recommended repository structure');
    expect(skillContent).toContain('bind an existing repository, or map/adapt an existing repository');
    expect(skillContent).not.toContain(
      'open app -> choose language/theme -> discover or install Gateway -> create local work repository -> enter the first matter -> open Workbench',
    );
    expect(skillContent).toContain('Repository Context 和仓库 `AGENTS.md`');
    expect(skillContent).toContain('ActionRun 是 OpenClaw Desktop 在普通聊天之外调用大模型的通用操作单元');
    expect(skillContent).toContain('ActionRun defaults to `workItemRequired: true`');
    expect(skillContent).toContain('workItemUnassignedReason: pending_work_item_assignment');
    expect(skillContent).toContain(
      '`createAiActionRun` does not keep orphan `workItemId` values without a `workItemPath`',
    );
    expect(skillContent).toContain('An ActionRun can carry `workItemId` and `workItemPath`');
    expect(skillContent).toContain("appends an execution record back to that matter's `## 执行记录` section");
    expect(skillContent).toContain('Workbench matter preview can prefill both values');
    expect(skillContent).toContain('ActionRunWorkItemPicker');
    expect(skillContent).toContain('shared matter picker');
    expect(skillContent).toContain('calls `onSelectedPathChange(created.path)` after creating a work matter');
    expect(skillContent).toContain('resolveAiActionWorkItemAssignment');
    expect(skillContent).toContain('createAiActionRunWithWorkItemAssignment');
    expect(skillContent).toContain('pages do not hand-roll `resolvedWorkItemId` / `resolvedWorkItemPath`');
    expect(skillContent).toContain('explicit source work matter assignment wins over the picker selection');
    expect(skillContent).toContain(
      'ActionCenter can let the user choose an existing work item or explicitly create a new matter under the current bound work root before backfilling assignment',
    );
    expect(skillContent).toContain('new matter creation uses the current bound work root');
    expect(skillContent).toContain('semantic mapped roots such as `10-ops/tasks/active/*.md`');
    expect(skillContent).not.toContain('create a new `work/active` matter');
    expect(skillContent).toContain('does not silently create or guess a work matter');
    expect(skillContent).toContain('Tasks magic-fill parsing also uses the shared work matter picker');
    expect(skillContent).toContain(
      'entry point still owns prompts, approvals, execution, backfill, and repository writes',
    );
    expect(skillContent).toContain('work_matter_plan');
    expect(skillContent).toContain('buildWorkMatterPlanPrompt');
    expect(skillContent).toContain(
      'Workbench `work_matter_plan` and `plan_execute` entry points also use `createAiActionRunWithWorkItemAssignment`',
    );
    expect(skillContent).toContain('The prompt uses the current bound plan root');
    expect(skillContent).toContain('10-ops/plans/active/<slug>.md');
    expect(skillContent).toContain('repositoryWrite.path/content/workItemPath');
    expect(skillContent).toContain('applyWorkbenchMatterPlanApproval');
    expect(skillContent).toContain('link it back to the source matter `## 关联计划`');
    expect(skillContent).toContain('/workbench?view=plans&planPath=<plan>');
    expect(skillContent).toContain('safe repository-relative Markdown plan paths');
    expect(skillContent).toContain('explicitly choose Execute Plan');
    expect(skillContent).toContain('First Matter Golden Path');
    expect(skillContent).toContain('buildWorkbenchMatterGoldenPathState()');
    expect(skillContent).toContain('plan, execution, output, knowledge, and review');
    expect(skillContent).toContain('reason key');
    expect(skillContent).toContain('execution-summary-missing');
    expect(skillContent).toContain('execution-failed');
    expect(skillContent).toContain(
      'Failed, cancelled, or completed-without-summary executions route back to Action Center',
    );
    expect(skillContent).toContain(
      'First Matter Golden Path blocks output, knowledge, and review follow-ups until the completed execution has a `resultSummary`',
    );
    expect(skillContent).toContain('Partial downstream facts do not make a summary-less execution complete');
    expect(skillContent).toContain('does not auto-create plans');
    expect(skillContent).toContain('/actions?runId=<run>');
    expect(skillContent).toContain('Action Center reads that `runId` from the URL');
    expect(skillContent).toContain('selects the matching ActionRun');
    expect(skillContent).toContain('plan_execute');
    expect(skillContent).toContain('buildPlanExecutePrompt');
    expect(skillContent).toContain(
      'when plan metadata includes a safe matter-like `workItemPath` recognized by the current Workbench Snapshot',
    );
    expect(skillContent).not.toContain(
      'under the default work roots or a semantic mapped active/completed/someday work root',
    );
    expect(skillContent).toContain('Terminal `plan_execute` runs reuse the existing ActionRun repository summary');
    expect(skillContent).toContain('findLatestPlanExecutionRun');
    expect(skillContent).toContain('latest plan execution status');
    expect(skillContent).toContain('shouldOfferPlanExecutionOutputPreservation');
    expect(skillContent).toContain(
      'Workbench plan preview and the first-matter golden path card also treat an existing `source.type=action_run` Artifact',
    );
    expect(skillContent).toContain('source id matches either the local run id or `gatewayRunId`');
    expect(skillContent).toContain('`action-run-output:<runId>`');
    expect(skillContent).toContain('Preserve Output');
    expect(skillContent).toContain('notifyActionRunsChanged');
    expect(skillContent).toContain('Dashboard and Workbench reload local ActionRun observers');
    expect(skillContent).toContain('artifact-ai-create-preview');
    expect(skillContent).toContain('rich `<artifact>` blocks');
    expect(skillContent).toContain('multiple Artifact candidates');
    expect(skillContent).toContain('one or more candidates');
    expect(skillContent).toContain('multiple selected candidates');
    expect(skillContent).toContain('edit title, type, description, tags, content summary');
    expect(skillContent).toContain('external format, reuse kind, URL, command, file path');
    expect(skillContent).toContain('trim file/link metadata strings');
    expect(skillContent).toContain('normalizeArtifactAICreatePreviewDraft');
    expect(skillContent).toContain('extractActionRunOutputCandidates');
    expect(skillContent).toContain('buildArtifactOutputPreservationPrompt');
    expect(skillContent).toContain('lastAssistantResponse');
    expect(skillContent).toContain('parseArtifactsFromText');
    expect(skillContent).toContain('<artifact>');
    expect(skillContent).toContain('explicit output candidates');
    expect(skillContent).toContain('Markdown link candidates are normalized into title, target, and description');
    expect(skillContent).toContain(
      'internal work/plan/review/wiki/source references outside output sections are ignored',
    );
    expect(skillContent).toContain(
      'asset run markdown is read into buildArtifactOutputPreservationPrompt as an additional candidate source',
    );
    expect(skillContent).toContain(
      'Even without a source work matter, Artifacts can still build a non-empty preservation prompt from the safe asset run context',
    );
    expect(skillContent).toContain(
      '`asset-run-output:*` source ids are preserved as output preservation source records',
    );
    expect(skillContent).toContain('shouldOfferPlanExecutionKnowledgeUpdate');
    expect(skillContent).toContain('`action-run-knowledge:<runId>`');
    expect(skillContent).toContain('Knowledge loads the source ActionRun by local id or `gatewayRunId`');
    expect(skillContent).toContain('using either the source `plan_execute` local `id` or `gatewayRunId`');
    expect(skillContent).toContain('Update Knowledge');
    expect(skillContent).toContain('shouldOfferPlanExecutionReview');
    expect(skillContent).toContain('`action-run-review:<runId>`');
    expect(skillContent).toContain('Write Review');
    expect(skillContent).toContain('links the draft back to the source matter `## 复盘`');
    expect(skillContent).toContain('non-failed, non-cancelled `knowledge_rewrite`');
    expect(skillContent).toContain(
      'sourceExecutionId` or `tailActionId` equal to either local or Gateway `action-run-review:<runId>`',
    );
    expect(skillContent).toContain('review follow-up matching reads only review document frontmatter');
    expect(skillContent).toContain('Long-unreviewed work item checks count review frontmatter `workItemPath`');
    expect(skillContent).toContain('Asset run review confirmation reads only review document frontmatter');
    expect(skillContent).toContain('relatedKnowledgeRunIds');
    expect(skillContent).toContain('a `## 相关知识更新` table with status and result/error summary');
    expect(skillContent).toContain('verify whether Wiki/index/log was updated or no write was needed');
    expect(skillContent).toContain('Review Knowledge Update');
    expect(skillContent).toContain('writePlanExecutionReviewWithKnowledge');
    expect(skillContent).toContain('Review Knowledge Write');
    expect(skillContent).toContain('Review No-Write Decision');
    expect(skillContent).toContain('getPlanExecutionKnowledgeReviewSuggestion');
    expect(skillContent).toContain('findPlanExecutionKnowledgeUpdateState');
    expect(skillContent).toContain('Knowledge No Write');
    expect(skillContent).toContain('findPlanExecutionReviewState');
    expect(skillContent).toContain('Review Draft');
    expect(skillContent).toContain('Review Confirmed');
    expect(skillContent).toContain('Confirm Plan Execution Review');
    expect(skillContent).toContain('confirmReviewSourceDraft');
    expect(skillContent).toContain('reviewSourceDraftConfirmed');
    expect(skillContent).toContain('does not check off a matter tail action for `action-run-review:<runId>`');
    expect(skillContent).toContain('Preserve Reviewed Output');
    expect(skillContent).toContain('Update Reviewed Knowledge');
    expect(skillContent).toContain('getPlanExecutionPostReviewActionSuggestion');
    expect(skillContent).toContain('adds a `## 收尾动作` checklist');
    expect(skillContent).toContain('missing from the repository run index');
    expect(skillContent).toContain('`action-run:unarchived` pending confirmation');
    expect(skillContent).toContain('Dashboard matches repository run index `runId` and `gatewayRunId` lines');
    expect(skillContent).toContain('has no `workItemPath`');
    expect(skillContent).toContain('`action-run:unassigned` pending confirmation');
    expect(skillContent).toContain('`action-run:output-unpreserved` pending confirmation');
    expect(skillContent).toContain('safe matter-like `workItemPath`');
    expect(skillContent).toContain('unsafe or non-matter `workItemPath` values are ignored');
    expect(skillContent).toContain(
      'no existing Artifact with `source.type=action_run` and a source id matching the local run id or `gatewayRunId`',
    );
    expect(skillContent).toContain('opens Artifacts with `tailAction=output`');
    expect(skillContent).toContain('does not auto-create an Artifact or Repository output');
    expect(skillContent).toContain(
      'unfinished `## 收尾动作` checklist items surface as Dashboard pending confirmations',
    );
    expect(skillContent).toContain(
      'Dashboard classifies tail actions as `tail-action:status`, `tail-action:output`, `tail-action:knowledge`, or `tail-action:review`',
    );
    expect(skillContent).toContain(
      'routes them to Workbench status handling, Artifacts, Knowledge, or Workbench review follow-up',
    );
    expect(skillContent).toContain(
      'Status tail actions can update the source matter `status` and check off only the matching status tail action',
    );
    expect(skillContent).toContain('does not automatically move the matter file');
    expect(skillContent).toContain('explicitly archive a `work/active/*.md` matter into `work/completed/*.md`');
    expect(skillContent).toContain(
      'Knowledge tail actions open Knowledge with the source matter preserved and can start a `knowledge_rewrite` ActionRun',
    );
    expect(skillContent).toContain(
      'reads the safe `runs/assets/*.md` markdown into the Knowledge rewrite instruction when present',
    );
    expect(skillContent).toContain('outputting `no_write_needed`');
    expect(skillContent).toContain('does not check off the knowledge tail action by itself');
    expect(skillContent).toContain(
      'After the user explicitly confirms that knowledge was updated or no write is needed',
    );
    expect(skillContent).toContain('check off only the matching source knowledge tail action');
    expect(skillContent).toContain('Review tail actions open Workbench reviews with a review tail action card');
    expect(skillContent).toContain('points to `reviews/weekly/`');
    expect(skillContent).toContain('exposes `desktop.artifacts.execution.review.write`');
    expect(skillContent).toContain('can create a draft work-item review in `reviews/weekly/`');
    expect(skillContent).toContain('links that draft back to the source matter `## 复盘`');
    expect(skillContent).toContain('does not check off the tail action by itself');
    expect(skillContent).toContain(
      'can confirm that draft, mark it as `status: confirmed`, add `reviewedAt`, and check off only the matching source tail action',
    );
    expect(skillContent).toContain(
      'Dashboard tail action targets carry `tailAction`, `tailActionId`, and `workItemPath`',
    );
    expect(skillContent).toContain('first usable action `tailActionIds` / `tail_action_ids` value');
    expect(skillContent).toContain('does not batch-confirm tail actions');
    expect(skillContent).toContain(
      'Dashboard also carries `assetRunPath` into `tail-action:output` and `tail-action:knowledge` routes',
    );
    expect(skillContent).toContain(
      'Even without a source work matter, Knowledge can start a source-bound `knowledge_rewrite` from a safe asset run context',
    );
    expect(skillContent).toContain('source asset run in the prompt when present');
    expect(skillContent).toContain('Artifacts opens the AI Artifact creation flow with the source work item attached');
    expect(skillContent).toContain('output-preservation tail actions prefill the Artifact creation prompt');
    expect(skillContent).toContain('Dashboard can mark a pending tail action complete and write it back');
    expect(skillContent).toContain('For non-`artifact_create` completed ActionRuns');
    expect(skillContent).toContain('`artifact_create` `<artifact>` blocks are preview candidates');
    expect(skillContent).toContain('valueHealth status/strengths/gaps/next actions');
    expect(skillContent).toContain('previewPlan clues');
    expect(skillContent).toContain('enrichment status');
    expect(skillContent).toContain('Ordinary completed chat assistant messages with `<artifact>` blocks');
    expect(skillContent).toContain('Desktop saves every parsed Artifact');
    expect(skillContent).toContain('Repository output / preview paths');
    expect(skillContent).toContain('latest unavailable enrichment reasons');
    expect(skillContent).toContain('native-thumbnail-platform-unsupported');
    expect(skillContent).toContain('fallback thumbnail');
    expect(skillContent).toContain('Generic file and unknown-format imports skip Quick Look');
    expect(skillContent).toContain('use-system-open-for-native-thumbnail-detail');
    expect(skillContent).toContain('legacy-binary-office');
    expect(skillContent).toContain('convert-legacy-office-or-open-with-system-app');
    expect(skillContent).toContain('Artifact write channel strategy');
    expect(skillContent).toContain('prefer direct Desktop plugin writes when the plugin is ready');
    expect(skillContent).toContain('fall back to `<artifact>` blocks when direct write is unavailable');
    expect(skillContent).toContain('direct write must still respect approval boundaries');
    expect(skillContent).toContain('artifactWriteChannel');
    expect(skillContent).toContain('auto-direct-with-fallback');
    expect(skillContent).toContain('preview-first');
    expect(skillContent).toContain('conversation-only');
    expect(skillContent).toContain('Artifact AI creation prompts read the current `artifactWriteChannel` setting');
    expect(skillContent).toContain('artifactWriteSafety');
    expect(skillContent).toContain('Desktop infers `local-file-reference`');
    expect(skillContent).toContain('Desktop infers `executable-asset`');
    expect(skillContent).toContain('JSON-style `"command"` / `"filePath"` metadata clues');
    expect(skillContent).toContain('structured `command:` / `command=` clues');
    expect(skillContent).toContain('structured `filePath` / `importFile` clues');
    expect(skillContent).toContain('command/script clues take precedence over local path clues');
    expect(skillContent).toContain('explicit caller-provided safety value still wins');
    expect(skillContent).toContain('local-file-reference');
    expect(skillContent).toContain('executable-asset');
    expect(skillContent).toContain('must not silently import local files');
    expect(skillContent).toContain('commands must not be executed');
    expect(skillContent).toContain('`preview-first` instructs the Agent not to call `desktop.artifacts.create`');
    expect(skillContent).toContain(
      '`conversation-only` forbids both `desktop.artifacts.create` and `desktop.outputs.create`',
    );
    expect(skillContent).toContain('Direct Desktop artifact command results with `{ ok: true, artifact: { id } }`');
    expect(skillContent).toContain('top-level `artifactId`');
    expect(skillContent).toContain('ActionRun `artifactIds` without saving a duplicate Artifact');
    expect(skillContent).toContain('preserves `output.path` in the ActionRun summary');
    expect(skillContent).toContain(
      'ArtifactAICreateDrawer treats those `artifactIds` as a direct-write completion state',
    );
    expect(skillContent).toContain('does not require a fallback `<artifact>` preview block');
    expect(skillContent).toContain(
      'Direct Desktop command failures with `{ ok: false, error }` mark the ActionRun as failed',
    );
    expect(skillContent).toContain('do not trigger automatic retry, duplicate save, or Repository output writes');
    expect(skillContent).toContain('If the same response includes a fallback `<artifact>` block');
    expect(skillContent).toContain('completed preview run so the user can explicitly save the candidate');
    expect(skillContent).toContain('Desktop Message Card Protocol');
    expect(skillContent).toContain('authorization cards, inquiry cards, Artifact cards, and ActionRun result cards');
    expect(skillContent).toContain('Inquiry cards');
    expect(skillContent).toContain('structured question, candidate answers');
    expect(skillContent).toContain('Empty inquiry fields may include `placeholder`, `multiline`, `options`');
    expect(skillContent).toContain('`optionsSource: "work-items"`');
    expect(skillContent).toContain('merges static options with repository-backed work item options');
    expect(skillContent).toContain('current Workbench Snapshot active, someday, and completed work items');
    expect(skillContent).toContain('semantic mapped work roots such as `10-ops/tasks/active/*.md`');
    expect(skillContent).not.toContain(
      'repository-backed work item options from `work/active`, `work/someday`, and `work/completed`',
    );
    expect(skillContent).toContain('`optionsSource: "plans"`');
    expect(skillContent).toContain('Repository-backed active plan options');
    expect(skillContent).toContain('Workbench Snapshot `activePlans`');
    expect(skillContent).toContain('semantic mapped active plan roots');
    expect(skillContent).toContain('`optionsSource: "artifacts"`');
    expect(skillContent).toContain('current Desktop Artifact list');
    expect(skillContent).toContain('unsupported field count on the rendered card');
    expect(skillContent).toContain('unsupported field-option count on the rendered card');
    expect(skillContent).toContain('unsupported option-source count on the rendered card');
    expect(skillContent).toContain('Desktop renders them as user-editable inputs, text areas, or select controls');
    expect(skillContent).toContain(
      'Required inquiry fields must have a preset value, user-entered draft, or action value before Desktop sends a `submit` callback',
    );
    expect(skillContent).toContain('`handle-later` is the exception');
    expect(skillContent).toContain('can send action values without required field values');
    expect(skillContent).toContain('does not record a submit confirmation');
    expect(skillContent).toContain('Card actions are declarative');
    expect(skillContent).toContain('Allowed card action kinds');
    expect(skillContent).toContain('`approve`, `deny`, `submit`, `handle-later`');
    expect(skillContent).toContain('`open-actions`');
    expect(skillContent).toContain('`open-dashboard`');
    expect(skillContent).toContain('`open-control-center`');
    expect(skillContent).toContain('`open-new-session`');
    expect(skillContent).toContain('`open-setup`');
    expect(skillContent).toContain('`open-settings`');
    expect(skillContent).toContain('`open-artifacts`');
    expect(skillContent).toContain('`open-workbench`');
    expect(skillContent).toContain('`open-plan`');
    expect(skillContent).toContain('`preserve-output`, `update-knowledge`, and `write-review`');
    expect(skillContent).toContain('unsupported action kinds are ignored by Desktop card parsing');
    expect(skillContent).toContain('unsupported field-list count');
    expect(skillContent).toContain('unsupported field-option-list count');
    expect(skillContent).toContain('unsupported artifact-clue count');
    expect(skillContent).toContain(
      'no usable `id`, `artifactId`, `artifactIds`, `title`, `artifactTitle`, `type`, `artifactType`, `uri`, `artifactUri`, `artifactUris`, `repositoryOutputPath`, `repositoryOutputPaths`, `filePath`, `filePaths`, `sourcePath`, `sourcePaths`, `path`, `paths`, `fileName`, `fileSize`, or `mimeType`',
    );
    expect(skillContent).toContain('unsupported actionrun-clue count');
    expect(skillContent).toContain(
      'no usable `id`, `gatewayRunId`, `status`, `artifactId`, `artifactUri`, `workItemPath`, `workItemId`, `planPath`, `repositoryOutputPath`, `knowledgePath`, `assetRunPath`, or `reviewPath`',
    );
    expect(skillContent).toContain('unsupported action count on the rendered card');
    expect(skillContent).toContain('unsupported action-definition count on the rendered card');
    expect(skillContent).toContain('unsupported action-value count on the rendered card');
    expect(skillContent).toContain('unsupported action-list count');
    expect(skillContent).toContain('unrenderable `<desktop-card>` blocks are left visible');
    expect(skillContent).toContain('Other card actions may be handled by auto-sending a structured user message');
    expect(skillContent).toContain('`handlerRoute`');
    expect(skillContent).toContain('`authorization-approval`');
    expect(skillContent).toContain('`artifact-save`');
    expect(skillContent).toContain('`artifact-import`');
    expect(skillContent).toContain('`artifact-mirror`');
    expect(skillContent).toContain('requires explicit user confirmation');
    expect(skillContent).toContain('`buildDesktopCardAuthorizationApprovalParams()` is the shared parser');
    expect(skillContent).toContain('`authorization-approval` can call `resolveDesktopCardAuthorizationApproval`');
    expect(skillContent).toContain('first usable action `actionRunIds` / `runIds` / `gatewayRunIds` value');
    expect(skillContent).toContain('record Repository asset approval decisions');
    expect(skillContent).toContain('calls `recordRepositoryAssetExecution()`');
    expect(skillContent).toContain('treat approved as execution success');
    expect(skillContent).toContain('`artifact-save` can call `publishArtifact`');
    expect(skillContent).toContain('same explicit Artifact id helper used by Artifact card navigation');
    expect(skillContent).toContain('batch-save multiple Artifacts');
    expect(skillContent).toContain('`artifact-import` can call `importArtifactFromFile`');
    expect(skillContent).toContain('Desktop message card `artifact-import` actions can also carry file path lists');
    expect(skillContent).toContain('`buildDesktopCardArtifactImportParams()` is the shared parser');
    expect(skillContent).toContain('first usable action `filePaths` / `sourcePaths` / `paths` value');
    expect(skillContent).toContain(
      'card `artifact.filePath` / `artifact.sourcePath` / `artifact.path` / first usable `artifact.filePaths` / `artifact.sourcePaths` / `artifact.paths` value',
    );
    expect(skillContent).toContain('card `artifact.title` / `artifact.artifactTitle`');
    expect(skillContent).toContain('`artifact.type` / `artifact.artifactType`');
    expect(skillContent).toContain('does not batch-import file path lists');
    expect(skillContent).toContain('`actionRun.id` or `actionRun.gatewayRunId`');
    expect(skillContent).toContain('`source.type=action_run` with that same run id');
    expect(skillContent).toContain('does not guess another local run');
    expect(skillContent).toContain('`artifact-mirror` can call `mirrorArtifactToRepository`');
    expect(skillContent).toContain('batch-mirror multiple Artifacts');
    expect(skillContent).toContain('ready Repository output boundary');
    expect(skillContent).toContain('Desktop may handle safe local routing actions without sending a callback');
    expect(skillContent).toContain('`open-artifact` and `preview-artifact` route to `/artifacts/<artifactId>`');
    expect(skillContent).toContain('action `artifactId` / `artifactUri`');
    expect(skillContent).toContain('first usable action `artifactIds` / `artifactUris` value');
    expect(skillContent).toContain('first usable card `artifact.artifactIds` / `artifact.artifactUris` value');
    expect(skillContent).toContain('the card `actionRun.artifactId`');
    expect(skillContent).toContain('first usable value from card `actionRun.artifactIds` / `actionRun.artifactUris`');
    expect(skillContent).toContain('card `artifact://...` URI clues');
    expect(skillContent).toContain('`open-artifacts` routes to `/artifacts`');
    expect(skillContent).toContain('only opens the existing Artifacts library');
    expect(skillContent).toContain('`open-actions` routes to `/actions`');
    expect(skillContent).toContain('`open-action-run` routes to `/actions?runId=<runId>`');
    expect(skillContent).toContain('first usable action `runIds` / `gatewayRunIds` / `actionRunIds` value');
    expect(skillContent).toContain(
      'first usable card `actionRun.runIds` / `actionRun.gatewayRunIds` / `actionRun.actionRunIds` value',
    );
    expect(skillContent).toContain('`open-dashboard` routes to `/`');
    expect(skillContent).toContain('`open-control-center` routes to `/control-center`');
    expect(skillContent).toContain('`open-new-session` routes to `/new-session`');
    expect(skillContent).toContain('`open-setup` routes to `/setup`');
    expect(skillContent).toContain('`open-settings` routes to `/settings`');
    expect(skillContent).toContain('`open-workbench` can open `/workbench?view=tasks&workItemPath=<matter>`');
    expect(skillContent).toContain('first safe action `workItemPaths` / `work_item_paths` value');
    expect(skillContent).toContain('Work item path lists skip non-matter candidates');
    expect(skillContent).toContain('`open-workbench-actions` routes to `/workbench?view=actions`');
    expect(skillContent).toContain('`open-workbench-tasks` routes to `/workbench?view=tasks`');
    expect(skillContent).toContain('`open-workbench-asset-runs` routes to `/workbench?view=outputs`');
    expect(skillContent).toContain('`open-plan` routes to `/workbench?view=plans&planPath=<plan>`');
    expect(skillContent).toContain('first usable action `planPaths` / `plan_paths` value');
    expect(skillContent).toContain('card `actionRun.planPath`');
    expect(skillContent).toContain('first usable card `actionRun.planPaths` value');
    expect(skillContent).toContain('`open-workbench` can reuse `actionRun.workItemPath`');
    expect(skillContent).toContain('first safe `actionRun.workItemPaths` value');
    expect(skillContent).toContain('Unsafe workbench paths fall back to `/workbench`');
    expect(skillContent).toContain('Gateway first-matter cards can use `open-workbench`');
    expect(skillContent).toContain('"id": "first-matter-next-step"');
    expect(skillContent).toContain('"workItemPath": "work/active/example.md"');
    expect(skillContent).toContain('"kind": "open-plan"');
    expect(skillContent).toContain('"planPath": "plans/active/example-plan.md"');
    expect(skillContent).toContain('does not generate a plan, execute an ActionRun, preserve output');
    expect(skillContent).toContain('`preserve-output` routes to `/artifacts?tailAction=output`');
    expect(skillContent).toContain('`update-knowledge` routes to `/knowledge?tailAction=knowledge`');
    expect(skillContent).toContain('`write-review` routes to `/workbench?tailAction=review`');
    expect(skillContent).toContain('Tail-action work item paths can use action `workItemPath` / `work_item_path`');
    expect(skillContent).toContain('first safe action `workItemPaths` / `work_item_paths` value');
    expect(skillContent).toContain('Tail-action work item path lists skip non-matter candidates');
    expect(skillContent).toContain('must pass `isSafeWorkbenchTailActionWorkItemPath()`');
    expect(skillContent).toContain(
      'Artifact cards may include `artifact: { id, artifactId, artifactIds, title, artifactTitle, type, artifactType, uri, artifactUri, artifactUris, repositoryOutputPath, repositoryOutputPaths, filePath, filePaths, sourcePath, sourcePaths, path, paths, fileName, fileSize, mimeType }`',
    );
    expect(skillContent).toContain(
      'ActionRun cards may include `actionRun: { id, status, artifactId, artifactUri, artifactIds, artifactUris, workItemPath, workItemPaths, workItemId, planPath, planPaths, repositoryOutputPath, repositoryOutputPaths, knowledgePath, assetRunPath, assetRunPaths, reviewPath }`',
    );
    expect(skillContent).toContain('first usable card `artifact.repositoryOutputPaths` value');
    expect(skillContent).toContain('or the card `actionRun.repositoryOutputPath`');
    expect(skillContent).toContain('or a safe action/card `actionRun.knowledgePath`');
    expect(skillContent).toContain('unsafe single review paths not blocking safe review path list fallbacks');
    expect(skillContent).toContain(
      'Desktop message card read-only document actions also accept first usable action path lists',
    );
    expect(skillContent).toContain('`open-knowledge-document` can use `knowledgePaths` / `sourcePaths` / `wikiPaths`');
    expect(skillContent).toContain('knowledge path lists skip unsafe Markdown candidates');
    expect(skillContent).toContain('`open-output` can use `outputPaths` / `repositoryOutputPaths`');
    expect(skillContent).toContain('`open-review` can use `reviewPaths` / `repositoryReviewPaths`');
    expect(skillContent).toContain('Artifact cards can also carry first usable Repository output path lists');
    expect(skillContent).toContain('`artifact.repositoryOutputPaths` / `artifact.outputPaths`');
    expect(skillContent).toContain('ActionRun result cards can also carry first usable read-only document path lists');
    expect(skillContent).toContain('`actionRun.knowledgePaths` / `actionRun.repositoryKnowledgePaths`');
    expect(skillContent).toContain('skips unsafe Markdown candidates in ActionRun knowledge path lists');
    expect(skillContent).toContain('`actionRun.repositoryOutputPaths` / `actionRun.outputPaths`');
    expect(skillContent).toContain('`actionRun.reviewPaths` / `actionRun.repositoryReviewPaths`');
    expect(skillContent).toContain('explicit `approvalId` or first usable `approvalIds` / `approval_ids` value');
    expect(skillContent).toContain('does not guess approval ids, batch approve approval id lists');
    expect(skillContent).toContain('first usable `assetIds` / `asset_ids` value');
    expect(skillContent).toContain('first executable `assetPaths` / `asset_paths` / `paths` value');
    expect(skillContent).toContain('Executable asset path lists skip `runs/assets/*.md`');
    expect(skillContent).toContain('first safe `sourceApprovalRunPaths` / `assetRunPaths` value');
    expect(skillContent).toContain('asset source approval run lists');
    expect(skillContent).toContain('Asset source approval run lists skip unsafe or non-asset-run candidates');
    expect(skillContent).toContain('first safe `workItemPaths` / `work_item_paths` value');
    expect(skillContent).toContain('Work item path lists skip non-matter candidates before authorization routing');
    expect(skillContent).toContain('for the related work item');
    expect(skillContent).toContain(
      'explicit Artifact id plus `executionEventId`, first usable `executionEventIds` / `eventIds` value',
    );
    expect(skillContent).toContain('batch decide execution event id lists');
    expect(skillContent).toContain('These follow-up actions can also carry a safe `assetRunPath`');
    expect(skillContent).toContain('first safe action `assetRunPaths` / `asset_run_paths` value');
    expect(skillContent).toContain('first safe card `actionRun.assetRunPaths` value');
    expect(skillContent).toContain('Asset run path lists skip unsafe or non-asset-run candidates');
    expect(skillContent).toContain('Even without work item context, a safe `assetRunPath` is preserved');
    expect(skillContent).toContain('Desktop only preserves it when it points to `runs/assets/*.md`');
    expect(skillContent).toContain('complete `runs/assets/*.md` tokens or Markdown links');
    expect(skillContent).toContain('suffix paths such as `.md.bak` are ignored');
    expect(skillContent).toContain('does not guess a matter from the asset run path');
    expect(skillContent).not.toContain('Without work item context they fall back to the safe page entry');
    expect(skillContent).toContain('Local routing does not approve, save, import, mirror');
    expect(skillContent).toContain('<desktop-card>');
    expect(skillContent).toContain('"version": 1');
    expect(skillContent).toContain('"kind": "authorization"');
    expect(skillContent).toContain('"kind": "inquiry"');
    expect(skillContent).toContain('"placeholder": "work/active/example.md"');
    expect(skillContent).toContain('"options": [{ "label": "路线图推进", "value": "work/active/roadmap.md" }]');
    expect(skillContent).toContain('"multiline": true');
    expect(skillContent).toContain('"kind": "artifact"');
    expect(skillContent).toContain('"kind": "action-run-result"');
    expect(skillContent).toContain('Desktop message card action confirmed');
    expect(skillContent).toContain('optional `artifact` / `actionRun` clues');
    expect(skillContent).toContain('from the source card');
    expect(skillContent).toContain('Inquiry field inputs and selected option values are included as field values');
    expect(skillContent).toContain('<artifact>');
    expect(skillContent).toContain('HTML 产物');
    expect(skillContent).toContain('完整自包含');
    expect(skillContent).toContain('htmlAudit');
    expect(skillContent).toContain('runtime authorization records');
    expect(skillContent).toContain('runtime bridge call records');
    expect(skillContent).toContain('artifactBridge.fetch');
    expect(skillContent).toContain('requires `network.fetch` approval');
    expect(skillContent).toContain('Direct browser `fetch()` remains blocked by CSP');
    expect(skillContent).toContain('artifactBridge.exec(command, options?)` is prepare-only');
    expect(skillContent).toContain('Desktop records an `approval_required` execution intent in `executionEvents`');
    expect(skillContent).toContain('artifactBridge.exportAs');
    expect(skillContent).toContain('requires `export` approval');
    expect(skillContent).toContain('must not be used for silent file writes');
    expect(skillContent).toContain('filePath');
    expect(skillContent).toContain('importFile');
    expect(skillContent).toContain('outputs/files/');
    expect(skillContent).toContain('Artifacts keep version history');
    expect(skillContent).toContain('version count and latest version metadata');
    expect(skillContent).toContain('artifact://<artifactId>');
    expect(skillContent).toContain('desktop.artifacts.search');
    expect(skillContent).toContain('Search existing Artifacts before asking the user for an artifact id');
    expect(skillContent).toContain('ordinary Chinese reusable-asset queries');
    expect(skillContent).toContain('可复用的脚本');
    expect(skillContent).toContain('Artifacts UI also exposes a reuse-kind filter');
    expect(skillContent).toContain('combines it with type and text search before sorting by recency');
    expect(skillContent).toContain('assetExecutionSummary');
    expect(skillContent).toContain('recordOnly');
    expect(skillContent).toContain('desktopExecutes: false');
    expect(skillContent).toContain('desktop.artifacts.inspect');
    expect(skillContent).toContain(
      'Dashboard first surfaces a work-system summary before Gateway infrastructure details',
    );
    expect(skillContent).toContain(
      'todayContinue, pendingConfirmations, stuckItems, recentOutputs, weeklyOutputs, and knowledgeUpdates',
    );
    expect(skillContent).toContain('Repository runs');
    expect(skillContent).toContain('Artifact outputs created during the current UTC week');
    expect(skillContent).toContain('Repository `outputs/index.md` entries whose `createdAt`');
    expect(skillContent).toContain('/workbench?view=outputs');
    expect(skillContent).toContain('terminal ActionRuns with `resultSummary` updated during the current UTC week');
    expect(skillContent).toContain('/workbench?view=actions');
    expect(skillContent).toContain('does not duplicate the ActionRun summary as another output');
    expect(skillContent).toContain(
      'explicit output clues from `reviews/` documents updated during the current UTC week',
    );
    expect(skillContent).toContain('/workbench?view=reviews');
    expect(skillContent).toContain('Review output clues are read only from explicit `成果`, `产物`, `输出`');
    expect(skillContent).toContain('does not infer value outputs from arbitrary review prose');
    expect(skillContent).toContain(
      'Dashboard stuckItems include failed or cancelled ActionRuns, blocked plans, explicit cross-work plan dependencies, and explicit work item metadata dependencies',
    );
    expect(skillContent).toContain('blockedReason');
    expect(skillContent).toContain('blockerOwner');
    expect(skillContent).toContain('`dependsOn`, `dependencies`, `requires`, `relatedWork`, `waitingOn`, `waitingFor`');
    expect(skillContent).toContain('`依赖`, `依赖事项`, `关联事项`, or `前置事项`');
    expect(skillContent).toContain('YAML-style list items under `dependencies:`');
    expect(skillContent).toContain('YAML-style object list items such as `path`, `workItemPath`, and `planPath`');
    expect(skillContent).toContain('normalizes relative Markdown dependency links');
    expect(skillContent).toContain('YAML inline array values');
    expect(skillContent).toContain('deduplicates normalized dependency paths');
    expect(skillContent).toContain('filters untrusted externally supplied dependency metadata');
    expect(skillContent).toContain('dependencySources');
    expect(skillContent).toContain('Dashboard cross-work risk details include `来源: <field>`');
    expect(skillContent).toContain('repository-parsed dependencies and precomputed Dashboard dependency metadata');
    expect(skillContent).toContain('safe semantic mapped completed directory segments');
    expect(skillContent).toContain('10-ops/tasks/completed/*.md');
    expect(skillContent).toContain('10-ops/plans/completed/*.md');
    expect(skillContent).toContain('10-ops/tasks/active/*.md');
    expect(skillContent).toContain('10-ops/plans/active/*.md');
    expect(skillContent).toContain('safe semantic mapped active/completed/someday Markdown paths');
    expect(skillContent).toContain('URLs, anchors, absolute paths, and non-workbench paths are ignored');
    expect(skillContent).toContain('unresolved dependencies as `plan:cross-work-risk` stuckItems');
    expect(skillContent).toContain('work item metadata dependencies surface as `work:cross-work-risk` stuckItems');
    expect(skillContent).toContain('Completed dependency paths from `completedWork`, `completedPlans`');
    expect(skillContent).toContain('default `work/completed/` or `plans/completed/`');
    expect(skillContent).toContain('safe semantic mapped completed directory segments');
    expect(skillContent).toContain('only unresolved dependencies remain visible');
    expect(skillContent).toContain('Unresolved dependency paths that have not changed for 14 days');
    expect(skillContent).toContain(
      'active plan dependencies without explicit owner metadata are marked as missing owner',
    );
    expect(skillContent).toContain('active work dependency owner metadata is surfaced when present');
    expect(skillContent).toContain('does not infer cross-work risk from plan or work prose');
    expect(skillContent).toContain('Dashboard plan stuck items from blocked plan metadata or `plan:cross-work-risk`');
    expect(skillContent).toContain('/workbench?view=plans&planPath=<plan>');
    expect(skillContent).toContain('Terminal work-item ActionRuns that are missing from `runs/action-runs/index.md`');
    expect(skillContent).toContain('not an automatic repository repair');
    expect(skillContent).toContain('Terminal ActionRuns without `workItemPath`');
    expect(skillContent).toContain('details include `workItemUnassignedReason`');
    expect(skillContent).toContain('not an automatic assignment');
    expect(skillContent).toContain(
      'Completed work-item ActionRuns with safe matter-like `workItemPath`, `resultSummary`, and no Artifact ids',
    );
    expect(skillContent).toContain(
      'unsafe or non-matter `workItemPath` values do not open the Artifacts preservation prompt',
    );
    expect(skillContent).toContain('do not auto-create Artifacts or Repository outputs');
    expect(skillContent).toContain(
      'After the user explicitly saves an Artifact from an output tail action, Desktop can link it back to `## 关联成果`',
    );
    expect(skillContent).toContain('Dashboard checkoff alone does not perform this archive');
    expect(skillContent).toContain('Knowledge tail actions can start a source-bound `knowledge_rewrite` ActionRun');
    expect(skillContent).toContain(
      'this explicit confirmation does not write Wiki/index/log, update matter status, preserve outputs, or write a review',
    );
    expect(skillContent).toContain(
      'Dashboard recent and weekly outputs mark reusable Artifacts and Repository outputs',
    );
    expect(skillContent).toContain('latest execution status or approval-required boundary');
    expect(skillContent).toContain('Knowledge health issues');
    expect(skillContent).toContain('Knowledge health long-unreviewed work checks use the current bound work root');
    expect(skillContent).toContain(
      'semantic mapped work roots such as `10-ops/tasks/active/` and `10-ops/tasks/someday/`',
    );
    expect(skillContent).toContain('orphan sources, stale index entries, broken knowledge links');
    expect(skillContent).not.toContain(
      '`work/active/`, `work/someday/`, `reviews/weekly/`, explicit contradiction markers',
    );
    expect(skillContent).toContain('undigested sources queue');
    expect(skillContent).toContain('Knowledge ActionRun can digest one queued source');
    expect(skillContent).toContain('clip URLs into `sources/imported/` with `source: desktop-url`');
    expect(skillContent).toContain('best-effort webpage fetch');
    expect(skillContent).toContain('urlFetchStatus');
    expect(skillContent).not.toContain('URL clipping does not fetch page bodies yet');
    expect(skillContent).toContain('not the primary answer to "what is my system state?"');
    expect(skillContent).toContain('Dashboard surfaces a "create your work system" onboarding path');
    expect(skillContent).toContain('choosing a workspace: continue temporarily');
    expect(skillContent).toContain('temporary-session carryover section with follow-ups');
    expect(skillContent).toContain('Parallel Shared Contract');
    expect(skillContent).toContain('main controller session');
    expect(skillContent).toContain('onboarding golden-path session');
    expect(skillContent).toContain('remaining P0 session');
    expect(skillContent).toContain('must reuse shared work matter, RepositoryGate, semantic mapping');
    expect(skillContent).toContain('ordinary repository profiles such as `任务/今天`');
    expect(skillContent).toContain('`笔记/会议纪要`');
    expect(skillContent).toContain('`notes/customer-interview`');
    expect(skillContent).toContain('`tasks/today`');
    expect(skillContent).toContain('`archive/2026-q2`');
    expect(skillContent).toContain('`kanban/doing.md`');
    expect(skillContent).toContain('`meetings/weekly-sync.md`');
    expect(skillContent).toContain('`decisions/adr-001.md`');
    expect(skillContent).toContain('`goals/q3-okr.md`');
    expect(skillContent).toContain('`issues/open.md`');
    expect(skillContent).toContain('`tickets/resolved.md`');
    expect(skillContent).toContain('`research/interviews/customer-a.md`');
    expect(skillContent).toContain('`specs/product-requirements.md`');
    expect(skillContent).toContain('`roadmaps/desktop-2026.md`');
    expect(skillContent).toContain('`milestones/q3-launch.md`');
    expect(skillContent).toContain('`feedback/customer-requests.md`');
    expect(skillContent).toContain('`risks/open.md`');
    expect(skillContent).toContain('`releases/q3-launch.md`');
    expect(skillContent).toContain('`qa/test-plan.md`');
    expect(skillContent).toContain('`playbooks/oncall.md`');
    expect(skillContent).toContain('`runbooks/deploy.md`');
    expect(skillContent).toContain('`rfcs/desktop-card-protocol.md`');
    expect(skillContent).toContain('`proposals/onboarding-flow.md`');
    expect(skillContent).toContain('`docs/architecture.md`');
    expect(skillContent).toContain('`docs/decisions.md`');
    expect(skillContent).toContain('`design/briefs/q3-redesign.md`');
    expect(skillContent).toContain('`fundraising/strategy.md`');
    expect(skillContent).toContain('`events/calendar.md`');
    expect(skillContent).toContain('design/research/experiment/dataset');
    expect(skillContent).toContain('fundraising/compliance/analytics/metrics');
    expect(skillContent).toContain('events/grants/donations/volunteers/community');
    expect(skillContent).toContain('media/brand/localization/translation');
    expect(skillContent).toContain('tax/insurance/warranty');
    expect(skillContent).toContain('subscription/membership/license');
    expect(skillContent).toContain('vehicle/pet/childcare/school');
    expect(skillContent).toContain('housing/rent/utilities/mortgage/moving');
    expect(skillContent).toContain('identity/visa/appointment');
    expect(skillContent).toContain('banking/loan/investment/retirement');
    expect(skillContent).toContain('recipe/meal/grocery/pantry/nutrition');
    expect(skillContent).toContain('order/delivery/package/return/receipt');
    expect(skillContent).toContain('job-search/career/resume/portfolio/interview');
    expect(skillContent).toContain('caregiving/prescription/doctor/medication');
    expect(skillContent).toContain('legal/court/estate/will');
    expect(skillContent).toContain('emergency/contact/household-inventory/disaster');
    expect(skillContent).toContain('hobby/garden/home-project/event-planning');
    expect(skillContent).toContain('reading/photo/family-memory/journal');
    expect(skillContent).toContain('habit/routine/chores/errands/gift');
    expect(skillContent).toContain('contacts/relationship/birthday/card');
    expect(skillContent).toContain('creative-writing/music/language-learning');
    expect(skillContent).toContain('small-business/inventory/vendor/procurement');
    expect(skillContent).toContain('restaurant/retail/staff operations');
    expect(skillContent).toContain('`restaurant/menu/seasonal-plan.md`');
    expect(skillContent).toContain('`restaurant/reservations/upcoming.md`');
    expect(skillContent).toContain('`restaurant/health-inspections/2026-07.md`');
    expect(skillContent).toContain('`retail/returns/open.md`');
    expect(skillContent).toContain('`门店/每日收银.md`');
    expect(skillContent).toContain(
      'does not execute design/research/fundraising/compliance/community/media/localization/tax/insurance/subscription/vehicle/pet/childcare/school/housing/identity/financial/meal/shopping/career/medical-care/legal-estate/emergency/hobby-garden-event/reading-photo-memory/habit-routine-chores-gift/contacts-relationship-card/creative-writing-music-language-learning/small-business-inventory-vendor-procurement work',
    );
    expect(skillContent).toContain('does not manage reservations, menus, shifts, health inspections, POS/cash');
    expect(skillContent).toContain('must not build a second private ActionRun assignment protocol');
    expect(skillContent).toContain('calls `sessions.get` to load full Gateway session history');
    expect(skillContent).toContain('falls back to currently visible messages');
    expect(skillContent).toContain('source: desktop-onboarding-session');
    expect(skillContent).toContain('links that source from the new matter `## 关联资料`');
    expect(skillContent).toContain('explicit temporary-session clues into the carryover');
    expect(skillContent).toContain('does not infer semantic clues from arbitrary prose');
    expect(skillContent).toContain('records file inspection facts only');
    expect(skillContent).toContain('previewPlan');
    expect(skillContent).toContain('safe preview strategy');
    expect(skillContent).toContain('valueHealth');
    expect(skillContent).toContain('ready`, `usable_with_limits`, or `needs_attention`');
    expect(skillContent).toContain('Browser PDF viewer previews are surfaced as `pdf-viewer-ready`');
    expect(skillContent).toContain('browser media controls as `media-controls-ready`');
    expect(skillContent).toContain('extracted text detail previews as `content-extract-preview-ready`');
    expect(skillContent).toContain(
      'Except for explicit URL PDF/media controls, imported PDF `documentPreview`, imported PDF/audio/video read-only `artifact-file://` controls, imported contentExtract text previews, and imported PDF/Office/media macOS Quick Look native thumbnails',
    );
    expect(skillContent).toContain('macOS Quick Look PNG native thumbnails');
    expect(skillContent).toContain('read-only file thumbnail panels');
    expect(skillContent).toContain('format placeholder thumbnail panels');
    expect(skillContent).toContain(
      'Explicit audio/video URLs and imported audio/video storage copies use the `browser_media_controls` strategy',
    );
    expect(skillContent).toContain(
      'Explicit PDF URLs, imported PDF `documentPreview`, and imported PDF storage copies using the read-only `artifact-file://<artifactId>/imported` protocol use the `browser_pdf_viewer` strategy',
    );
    expect(skillContent).toContain(
      'those browser-detail preview plans use `view_detail` / `open-artifact-detail` instead of telling the user to open the system app',
    );
    expect(skillContent).toContain('`content_extract_preview` strategy on the Artifact detail surface');
    expect(skillContent).toContain('read-only text preview instead of the system app');
    expect(skillContent).toContain(
      'the same media panel shows read-only file facts such as file size, short sha256, and file signature beside the controls',
    );
    expect(skillContent).toContain(
      'including inside imported audio/video media panels when the browser controls are already the primary preview',
    );
    expect(skillContent).toContain('should not be marked with `native-preview-missing`');
    expect(skillContent).toContain('unimported local media paths still stay on the system app boundary');
    expect(skillContent).toContain('default to page 1 with `zoom=page-width`');
    expect(skillContent).toContain('lets the user change PDF page number and zoom');
    expect(skillContent).toContain('shows the PDF version and page count beside the viewer');
    expect(skillContent).toContain('read-only `artifact-file://<artifactId>/imported` protocol');
    expect(skillContent).toContain('only serves imported Artifact storage copies and never arbitrary local paths');
    expect(skillContent).toContain('supports byte `Range` requests for browser PDF/media streaming');
    expect(skillContent).toContain('returns 206/416 range responses without exposing arbitrary file paths');
    expect(skillContent).toContain(
      'must not return image/PDF/Quick Look thumbnail data URLs or `artifact-file://` preview URLs',
    );
    expect(skillContent).toContain('does not parse Office/PDF/media contents');
    expect(skillContent).toContain('desktop.artifacts.content.extract');
    expect(skillContent).toContain(
      'text/code/HTML/PDF, Word/Excel/PowerPoint OOXML, legacy Word `.doc`, and legacy Excel/PowerPoint `.xls/.ppt` file Artifacts automatically record `contentExtract`',
    );
    expect(skillContent).toContain(
      'reads only imported text/code/HTML/PDF, Word/Excel/PowerPoint OOXML, legacy Word, and legacy Excel/PowerPoint Artifact copies',
    );
    expect(skillContent).toContain('Legacy Word extraction uses macOS textutil best-effort');
    expect(skillContent).toContain('Legacy Excel extraction uses BIFF8 structured rows plus printable-text fallback');
    expect(skillContent).toContain(
      'Legacy PowerPoint extraction uses TextHeaderAtom text bodies plus printable-text fallback',
    );
    expect(skillContent).toContain('Legacy Excel BIFF8 can also reconstruct selected shared-string');
    expect(skillContent).toContain('BIFF8 Date1904 workbook records');
    expect(skillContent).toContain('fractional Excel serial days as minute or second ISO timestamps');
    expect(skillContent).toContain('time-only formats can render fractional Excel serial days as HH:mm or HH:mm:ss');
    expect(skillContent).toContain(
      'elapsed time formats can render fractional Excel serial days as cumulative [h]:mm or [h]:mm:ss',
    );
    expect(skillContent).toContain(
      'elapsed minute formats can render fractional Excel serial days as cumulative [m]:ss',
    );
    expect(skillContent).toContain('elapsed second formats can render fractional Excel serial days as cumulative [s]');
    expect(skillContent).toContain('Legacy PowerPoint can decode TextHeaderAtom text bodies');
    expect(skillContent).toContain('common TextHeaderAtom recInstance values 0..8');
    expect(skillContent).toContain('Legacy PowerPoint can group TextHeaderAtom text bodies by SlideContainer sections');
    expect(skillContent).toContain('NotesContainer sections as # Notes N');
    expect(skillContent).toContain(
      'does not read arbitrary local paths, restore full legacy Office structure, parse audio/video files, render native previews',
    );
    expect(skillContent).toContain('desktop.artifacts.content.facts.extract');
    expect(skillContent).toContain('Newly imported non-text file Artifacts');
    expect(skillContent).toContain('sha256, signature hex, image dimensions, and best-effort PDF version/page count');
    expect(skillContent).toContain('does not replace `contentExtract`, restore legacy Office structure');
    expect(skillContent).toContain('desktop.artifacts.document.preview.extract');
    expect(skillContent).toContain('Small newly imported PDF file Artifacts can record `documentPreview`');
    expect(skillContent).toContain('must not embed the PDF data URL');
    expect(skillContent).toContain('desktop.artifacts.file.import');
    expect(skillContent).toContain('imports only the existing Artifact `filePath`');
    expect(skillContent).toContain(
      'After import, PDF/audio/video detail previews may use the read-only `artifact-file://<artifactId>/imported` protocol',
    );
    expect(skillContent).toContain('the protocol accepts browser byte Range requests for streaming');
    expect(skillContent).toContain('does not guess local paths');
    expect(skillContent).toContain('desktop.artifacts.thumbnail.extract');
    expect(skillContent).toContain(
      'Newly imported image, PDF, Word/Excel/PowerPoint, audio, video, generic file, and unknown-format Artifacts can record `thumbnail`',
    );
    expect(skillContent).toContain('PDF/Office/audio/video use macOS Quick Look');
    expect(skillContent).toContain(
      'non-macOS native thumbnail gaps are recorded as `native-thumbnail-platform-unsupported` unavailable',
    );
    expect(skillContent).toContain('native file thumbnail panel');
    expect(skillContent).toContain('format placeholder thumbnail panel');
    expect(skillContent).toContain('record only thumbnail availability');
    expect(skillContent).toContain('must not embed the data URL');
    expect(skillContent).toContain('document preview extraction');
    expect(skillContent).toContain('Desktop records `enrichmentEvents`');
    expect(skillContent).toContain('status (`succeeded`, `unavailable`, or `failed`)');
    expect(skillContent).toContain(
      'Artifact detail, search text, Repository output markdown, and `outputs/index.md` expose these audit clues',
    );
    expect(skillContent).toContain('desktop.artifacts.describe');
    expect(skillContent).toContain('desktop.outputs.create');
    expect(skillContent).toContain('Repository `outputs/index.md`');
    expect(skillContent).toContain(
      'artifact URI, source, created time, updated time, preview, format, summary, thumbnail availability, value health, preview plan, content extraction status, content facts status, PDF facts, preview card, reuse kind, and tags',
    );
    expect(skillContent).toContain('Repository `outputs/assets/index.md`');
    expect(skillContent).toContain('under the "Reusable Assets" heading');
    expect(skillContent).toContain('desktop.repository.assets.record');
    expect(skillContent).toContain('desktop.repository.assets.search');
    expect(skillContent).toContain('desktop.repository.assets.execution.record');
    expect(skillContent).toContain('runs/assets/');
    expect(skillContent).toContain('runs/assets/index.md');
    expect(skillContent).toContain('safe `workItemPath` under the current bound work root');
    expect(skillContent).toContain('semantic mapped work items such as `10-ops/tasks/active/*.md`');
    expect(skillContent).not.toContain('under the bound Repository `work/` root');
    expect(skillContent).toContain("appends the asset execution to that matter's `## 执行记录` section");
    expect(skillContent).toContain('`## 收尾动作` checklist items for status, output, knowledge, and review follow-up');
    expect(skillContent).toContain(
      'each generated status, output, knowledge, and review tail action includes the same source `runs/assets/*.md` link',
    );
    expect(skillContent).toContain('Asset Permission Boundary panel');
    expect(skillContent).toContain('`recordOnly`, `desktopExecutes`, `grantsPermission`');
    expect(skillContent).toContain('does not infer permission from prose');
    expect(skillContent).toContain('buildRepositoryAssetExecutionApprovalCommand()');
    expect(skillContent).toContain('Approval Action');
    expect(skillContent).toContain('approval_required');
    expect(skillContent).toContain('approvalTitle');
    expect(skillContent).toContain('approvalRisk');
    expect(skillContent).toContain('approvalReason');
    expect(skillContent).toContain('Asset Run Details panel');
    expect(skillContent).toContain('parseRepositoryAssetRunDetails()');
    expect(skillContent).toContain('displays explicit title, asset id/path/reuse kind, status, runner, command');
    expect(skillContent).toContain('getRepositoryAssetRunOutputState()');
    expect(skillContent).toContain('Output Preserved');
    expect(skillContent).toContain('Output Pending');
    expect(skillContent).toContain('Preserve Output, Update Knowledge, and Write Review buttons');
    expect(skillContent).toContain('`asset-run-output:*` / `asset-run-knowledge:*` / `asset-run-review:*`');
    expect(skillContent).toContain('findRepositoryAssetRunReviewState()');
    expect(skillContent).toContain('Review Draft or Review Confirmed');
    expect(skillContent).toContain('findRepositoryAssetRunFollowUpState()');
    expect(skillContent).toContain('Run Follow-ups');
    expect(skillContent).toContain('Workbench Snapshot includes `runs/assets/index.md` in Repository runs');
    expect(skillContent).toContain('filter Run History to Asset Runs');
    expect(skillContent).toContain('parseRepositoryAssetRunIndexLinks()');
    expect(skillContent).toContain('approvalState: pending / approved / denied');
    expect(skillContent).toContain('activity list also displays approval title, risk, and reason');
    expect(skillContent).toContain(
      'activity list also surfaces later approval decisions, terminal execution state, downstream output state, same-source knowledge update state, and same-source review state',
    );
    expect(skillContent).toContain(
      'activity knowledge status filter reads `knowledgeUpdateState` from the same list follow-up state',
    );
    expect(skillContent).toContain('review display can read `reviewState` from the same shared state');
    expect(skillContent).toContain('activity list filters pending review by confirmed asset run reviews');
    expect(skillContent).toContain(
      'activity list displays the pending review tag from the same effective review state',
    );
    expect(skillContent).toContain('getRepositoryAssetRunEffectiveReviewState()');
    expect(skillContent).toContain('All Reviews, Pending Review, Review Draft, or Review Confirmed');
    expect(skillContent).toContain(
      'activity list filters approval by the effective state after later decisions or terminal execution',
    );
    expect(skillContent).toContain('activity list also surfaces the downstream terminal run output state');
    expect(skillContent).toContain(
      'activity list filters output by the effective state after downstream terminal execution',
    );
    expect(skillContent).toContain('All Approvals, Pending Approval, Approved, or Denied');
    expect(skillContent).toContain('buildRepositoryAssetRunApprovalDecisionCommands()');
    expect(skillContent).toContain('approved and denied `desktop.repository.assets.execution.record` commands');
    expect(skillContent).toContain(
      'include `sourceApprovalRunPath` pointing back to the pending `runs/assets/*.md` record',
    );
    expect(skillContent).toContain(
      'record Artifact execution approval decisions when the card carries an explicit Artifact id plus `executionEventId`, first usable `executionEventIds` / `eventIds` value, or command',
    );
    expect(skillContent).toContain('Repository asset approval cards can carry `sourceApprovalRunPath`');
    expect(skillContent).toContain('external runner handoff decision for `artifactBridge.exec`');
    expect(skillContent).toContain('findRepositoryAssetRunApprovalDecisionState()');
    expect(skillContent).toContain('prefers exact `sourceApprovalRunPath` matches before legacy same-asset matching');
    expect(skillContent).toContain('Approval Recorded or Denial Recorded');
    expect(skillContent).toContain('stops showing duplicate approval-decision copy commands');
    expect(skillContent).toContain('findRepositoryAssetRunExecutionState()');
    expect(skillContent).toContain(
      'Terminal execution state uses the same `sourceApprovalRunPath` precision when present',
    );
    expect(skillContent).toContain('Run Succeeded, Run Failed, or Run Cancelled');
    expect(skillContent).toContain('filter by execution status, pending review, and output state');
    expect(skillContent).toContain('The run list shows Output Preserved or Output Pending');
    expect(skillContent).toContain(
      'opens asset run output clues without an output Artifact through Workbench outputs with `assetRunPath`',
    );
    expect(skillContent).toContain('auto-previews the source `runs/assets/*.md` record');
    expect(skillContent).toContain('readWorkbenchMarkdown(binding, assetRunPath)');
    expect(skillContent).toContain('asset-run:review-pending');
    expect(skillContent).toContain(
      'preserves the source `assetRunPath` through the existing `tail-action:output` and `tail-action:knowledge` targets',
    );
    expect(skillContent).toContain('Artifacts and Knowledge can show and prompt from the exact asset run context');
    expect(skillContent).toContain('lastRun');
    expect(skillContent).toContain('Repository-relative `path`');
    expect(skillContent).toContain('post-run review clue when available');
    expect(skillContent).toContain('recordOnly, desktopExecutes=false, grantsPermission=false');
    expect(skillContent).toContain('externalFormat');
    expect(skillContent).toContain('reuseKind');
    expect(skillContent).toContain('asset`, `template`, `tool`, `script`, or `workflow`');
    expect(skillContent).toContain('Artifacts page reuse-kind filter');
    expect(skillContent).toContain('classification and traceability');
    expect(skillContent).toContain('desktop.artifacts.reuse.record');
    expect(skillContent).toContain('records reuse/audit facts only');
    expect(skillContent).toContain('does not execute tools, open files, or grant permissions');
    expect(skillContent).toContain('desktop.artifacts.execution.prepare');
    expect(skillContent).toContain('records an approval-required execution intent');
    expect(skillContent).toContain('desktop.artifacts.execution.record');
    expect(skillContent).toContain('records executable Artifact run and review-needed facts only');
    expect(skillContent).toContain('post-run review clues');
    expect(skillContent).toContain('reviewSummary');
    expect(skillContent).toContain('desktop.artifacts.execution.review.write');
    expect(skillContent).toContain('writes a `reviews/weekly/` Markdown review');
    expect(skillContent).toContain('Artifact detail can show a Write execution review entry');
    expect(skillContent).toContain('copy the same JSON command');
    expect(skillContent).toContain('Artifact detail surfaces an Execution boundary panel');
    expect(skillContent).toContain(
      'shows `desktop.artifacts.execution.prepare` and `desktop.artifacts.execution.record`',
    );
    expect(skillContent).toContain('latest Artifact execution approval decision');
    expect(skillContent).toContain(
      'Desktop only records approval and execution facts; it does not execute the Artifact or grant permission',
    );
    expect(skillContent).toContain(
      'does not execute the Artifact, grant execution permission, write the review automatically, or update the work item',
    );
    expect(skillContent).toContain(
      'does not execute commands, grant execution permission, or write the review automatically',
    );
    expect(skillContent).toContain('tool`, `script`, or `workflow`');
    expect(skillContent).toContain('does not execute commands or grant execution permission');
    expect(skillContent).toContain(
      'Artifacts list search, Dashboard recent/weekly outputs, and Workbench outputs surface value summaries',
    );
    expect(skillContent).toContain('Repository output / preview clues');
    expect(skillContent).toContain('system file handler');
    expect(skillContent).toContain('imported into Artifact storage');
    expect(skillContent).toContain('Artifact preview card');
    expect(skillContent).toContain('format label, thumbnail label, summary, location, primary action, and safety note');
    expect(skillContent).toContain(
      'PDF/browser media cards that already have a detail-page viewer point their primary action to Artifact detail',
    );
    expect(skillContent).toContain('Gateway-facing search/describe preview cards expose `thumbnailAvailable`');
    expect(skillContent).toContain('`thumbnailKind`');
    expect(skillContent).toContain('`thumbnailSummary`');
    expect(skillContent).toContain('image-thumbnail-ready');
    expect(skillContent).toContain('native-thumbnail-ready');
    expect(skillContent).toContain('format-placeholder-thumbnail-ready');
    expect(skillContent).toContain('document preview availability');
    expect(skillContent).toContain(
      'must not return image/PDF/Quick Look thumbnail data URLs or `artifact-file://` preview URLs',
    );
    expect(skillContent).toContain('return thumbnail data URLs');
    expect(skillContent).toContain('preview cards');
    expect(skillContent).toContain('Repository output markdown expose this preview card');
    expect(skillContent).toContain('contentSummary');
    expect(skillContent).toContain('externalFormat');
    expect(skillContent).not.toContain(OPENCLAW_REPOSITORY_CONTEXT_START);
    expect(skillContent).not.toContain(OPENCLAW_REPOSITORY_CONTEXT_END);
  });

  it('builds a stable self-knowledge payload for the generated skill', () => {
    const skillContent = '# Skill\n\nDesktop rules.';

    expect(
      buildDesktopSelfKnowledgePayload({
        skillContent,
        updatedAt: 123456,
      }),
    ).toEqual({
      version: 1,
      skillName: DESKTOP_SELF_KNOWLEDGE_SKILL_NAME,
      skillPath: DESKTOP_SELF_KNOWLEDGE_SKILL_PATH,
      skillContent,
      skillContentHash: hashDesktopSelfKnowledgeText(skillContent),
      updatedAt: 123456,
    });
  });

  it('builds a managed Desktop self-knowledge block with independent sentinels', () => {
    const payload = buildDesktopSelfKnowledgePayload({
      skillContent: '# Skill\n\nDesktop operator rules.',
      updatedAt: 1,
    });

    const block = buildDesktopSelfKnowledgeBlock(payload);

    expect(block).toContain(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START);
    expect(block).toContain(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END);
    expect(block).toContain(`Skill name: ${DESKTOP_SELF_KNOWLEDGE_SKILL_NAME}`);
    expect(block).toContain(`Skill path: ${DESKTOP_SELF_KNOWLEDGE_SKILL_PATH}`);
    expect(block).toContain('Desktop operator rules.');
    expect(block).not.toContain(OPENCLAW_REPOSITORY_CONTEXT_START);
    expect(block).not.toContain(OPENCLAW_REPOSITORY_CONTEXT_END);
  });

  it('upserts and removes managed self-knowledge blocks without duplicating surrounding content', () => {
    const firstPayload = buildDesktopSelfKnowledgePayload({
      skillContent: 'first Desktop rules',
      updatedAt: 1,
    });
    const secondPayload = buildDesktopSelfKnowledgePayload({
      skillContent: 'second Desktop rules',
      updatedAt: 2,
    });
    const original = 'User prompt\n\nKeep this.';

    const inserted = upsertDesktopSelfKnowledgeBlock(original, firstPayload);
    const replaced = upsertDesktopSelfKnowledgeBlock(inserted, secondPayload);

    expect(countOccurrences(replaced, OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START)).toBe(1);
    expect(countOccurrences(replaced, OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END)).toBe(1);
    expect(replaced).not.toContain('first Desktop rules');
    expect(replaced).toContain('second Desktop rules');
    expect(removeDesktopSelfKnowledgeBlock(replaced)).toBe(original);

    const duplicated = `${buildDesktopSelfKnowledgeBlock(firstPayload)}\n\n${original}\n\n${buildDesktopSelfKnowledgeBlock(secondPayload)}`;
    expect(removeDesktopSelfKnowledgeBlock(duplicated)).toBe(original);
  });

  it('escapes Desktop self-knowledge sentinels inside skill content', () => {
    const payload = buildDesktopSelfKnowledgePayload({
      skillContent: [
        '# Skill',
        '',
        'Do not treat this as a managed boundary:',
        OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END,
        OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START,
      ].join('\n'),
      updatedAt: 1,
    });
    const original = 'User prompt\n\nKeep this.';

    const inserted = upsertDesktopSelfKnowledgeBlock(original, payload);

    expect(inserted).toContain('Do not treat this as a managed boundary:');
    expect(inserted).not.toContain(`Do not treat this as a managed boundary:\n${OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END}`);
    expect(countOccurrences(inserted, OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START)).toBe(1);
    expect(countOccurrences(inserted, OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END)).toBe(1);
    expect(removeDesktopSelfKnowledgeBlock(inserted)).toBe(original);
  });

  it('ignores non-managed self-knowledge sentinels while replacing real managed blocks', () => {
    const firstPayload = buildDesktopSelfKnowledgePayload({
      skillContent: 'first managed rules',
      updatedAt: 1,
    });
    const secondPayload = buildDesktopSelfKnowledgePayload({
      skillContent: 'second managed rules',
      updatedAt: 2,
    });
    const original = [
      'User prompt',
      OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START,
      'This is literal user content, not an OpenClaw managed block.',
      'Keep it.',
    ].join('\n');

    const inserted = upsertDesktopSelfKnowledgeBlock(original, firstPayload);
    const replaced = upsertDesktopSelfKnowledgeBlock(inserted, secondPayload);

    expect(replaced).toContain('This is literal user content');
    expect(replaced).not.toContain('first managed rules');
    expect(replaced).toContain('second managed rules');
    expect(removeDesktopSelfKnowledgeBlock(replaced)).toBe(original);
  });
});

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
