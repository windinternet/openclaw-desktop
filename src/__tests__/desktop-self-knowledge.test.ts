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
      'open app -> choose language/theme -> discover or install Gateway -> create local work repository -> enter the first matter -> open Workbench',
    );
    expect(skillContent).toContain('Repository Context 和仓库 `AGENTS.md`');
    expect(skillContent).toContain('ActionRun 是 OpenClaw Desktop 在普通聊天之外调用大模型的通用操作单元');
    expect(skillContent).toContain('An ActionRun can carry `workItemId` and `workItemPath`');
    expect(skillContent).toContain("appends an execution record back to that matter's `## 执行记录` section");
    expect(skillContent).toContain('Workbench matter preview can prefill both values');
    expect(skillContent).toContain('adds a `## 收尾动作` checklist');
    expect(skillContent).toContain('missing from the repository run index');
    expect(skillContent).toContain('`action-run:unarchived` pending confirmation');
    expect(skillContent).toContain('has no `workItemPath`');
    expect(skillContent).toContain('`action-run:unassigned` pending confirmation');
    expect(skillContent).toContain('`action-run:output-unpreserved` pending confirmation');
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
    expect(skillContent).toContain(
      'Knowledge tail actions open Knowledge with the source matter preserved and can start a `knowledge_rewrite` ActionRun',
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
    expect(skillContent).toContain('does not check off the tail action by itself');
    expect(skillContent).toContain(
      'can confirm that draft, mark it as `status: confirmed`, add `reviewedAt`, and check off only the matching source tail action',
    );
    expect(skillContent).toContain(
      'Dashboard tail action targets carry `tailAction`, `tailActionId`, and `workItemPath`',
    );
    expect(skillContent).toContain('Artifacts opens the AI Artifact creation flow with the source work item attached');
    expect(skillContent).toContain('output-preservation tail actions prefill the Artifact creation prompt');
    expect(skillContent).toContain('Dashboard can mark a pending tail action complete and write it back');
    expect(skillContent).toContain('completed ActionRun response contains `<artifact>` blocks');
    expect(skillContent).toContain('valueHealth status/gaps/next actions');
    expect(skillContent).toContain('previewPlan clues');
    expect(skillContent).toContain('enrichment status');
    expect(skillContent).toContain('Ordinary completed chat assistant messages with `<artifact>` blocks');
    expect(skillContent).toContain('Desktop saves every parsed Artifact');
    expect(skillContent).toContain('Repository output / preview paths');
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
      'Dashboard stuckItems include failed or cancelled ActionRuns, blocked plans, and explicit cross-work plan dependencies',
    );
    expect(skillContent).toContain('blockedReason');
    expect(skillContent).toContain('blockerOwner');
    expect(skillContent).toContain('`dependsOn`, `dependencies`, `requires`, `relatedWork`');
    expect(skillContent).toContain('`依赖`, `依赖事项`, `关联事项`, or `前置事项`');
    expect(skillContent).toContain('unresolved dependencies as `plan:cross-work-risk` stuckItems');
    expect(skillContent).toContain('Completed dependency paths from `completedWork`, `completedPlans`');
    expect(skillContent).toContain('`work/completed/`, or `plans/completed/`');
    expect(skillContent).toContain('only unresolved dependencies remain visible');
    expect(skillContent).toContain('Unresolved dependency paths that have not changed for 14 days');
    expect(skillContent).toContain(
      'active plan dependencies without explicit owner metadata are marked as missing owner',
    );
    expect(skillContent).toContain('does not infer cross-work risk from plan prose');
    expect(skillContent).toContain('/workbench?view=plans');
    expect(skillContent).toContain('Terminal work-item ActionRuns that are missing from `runs/action-runs/index.md`');
    expect(skillContent).toContain('not an automatic repository repair');
    expect(skillContent).toContain('Terminal ActionRuns without `workItemPath`');
    expect(skillContent).toContain('not an automatic assignment');
    expect(skillContent).toContain('Completed work-item ActionRuns with `resultSummary` and no Artifact ids');
    expect(skillContent).toContain('do not auto-create Artifacts or Repository outputs');
    expect(skillContent).toContain(
      'After the user explicitly saves an Artifact from an output tail action, Desktop can link it back to `## 关联成果`',
    );
    expect(skillContent).toContain('Knowledge tail actions can start a source-bound `knowledge_rewrite` ActionRun');
    expect(skillContent).toContain(
      'this explicit confirmation does not write Wiki/index/log, update matter status, preserve outputs, or write a review',
    );
    expect(skillContent).toContain(
      'Dashboard recent and weekly outputs mark reusable Artifacts and Repository outputs',
    );
    expect(skillContent).toContain('latest execution status or approval-required boundary');
    expect(skillContent).toContain('Knowledge health issues');
    expect(skillContent).toContain('orphan sources, stale index entries, broken knowledge links');
    expect(skillContent).toContain('undigested sources queue');
    expect(skillContent).toContain('Knowledge ActionRun can digest one queued source');
    expect(skillContent).toContain('not the primary answer to "what is my system state?"');
    expect(skillContent).toContain('Dashboard surfaces a "create your work system" onboarding path');
    expect(skillContent).toContain('writes the first user-entered matter into `work/active/YYYY-MM-DD-HHmmss-*.md`');
    expect(skillContent).toContain('records file inspection facts only');
    expect(skillContent).toContain('previewPlan');
    expect(skillContent).toContain('safe preview strategy');
    expect(skillContent).toContain('valueHealth');
    expect(skillContent).toContain('ready`, `usable_with_limits`, or `needs_attention`');
    expect(skillContent).toContain('does not parse Office/PDF/media contents');
    expect(skillContent).toContain('render Office/PDF/media native previews');
    expect(skillContent).toContain('desktop.artifacts.content.extract');
    expect(skillContent).toContain(
      'text/code/HTML/PDF and Word/Excel/PowerPoint OOXML file Artifacts automatically record `contentExtract`',
    );
    expect(skillContent).toContain(
      'reads only imported text/code/HTML/PDF and Word/Excel/PowerPoint OOXML Artifact copies',
    );
    expect(skillContent).toContain(
      'PDF and OOXML extraction are best-effort text extraction from PDF text streams or OOXML XML entries',
    );
    expect(skillContent).toContain(
      'does not read arbitrary local paths, parse legacy binary Office/audio/video files, render native previews',
    );
    expect(skillContent).toContain('desktop.artifacts.content.facts.extract');
    expect(skillContent).toContain('Newly imported non-text file Artifacts');
    expect(skillContent).toContain('sha256, signature hex, image dimensions, and best-effort PDF version/page count');
    expect(skillContent).toContain('does not replace `contentExtract`, parse legacy binary Office document bodies');
    expect(skillContent).toContain('desktop.artifacts.thumbnail.extract');
    expect(skillContent).toContain('Newly imported image file Artifacts can record `thumbnail`');
    expect(skillContent).toContain('record only thumbnail availability');
    expect(skillContent).toContain('must not embed the data URL');
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
    expect(skillContent).toContain(
      'does not execute the Artifact, grant execution permission, or update the work item',
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
    expect(skillContent).toContain('Gateway-facing search/describe preview cards expose `thumbnailAvailable`');
    expect(skillContent).toContain('must not return image data URLs');
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
