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
    expect(skillContent).toContain('Repository Context 和仓库 `AGENTS.md`');
    expect(skillContent).toContain('ActionRun 是 OpenClaw Desktop 在普通聊天之外调用大模型的通用操作单元');
    expect(skillContent).toContain('completed ActionRun response contains `<artifact>` blocks');
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
    expect(skillContent).toContain('artifactBridge.exec()` remains unsupported');
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
    expect(skillContent).toContain('desktop.artifacts.describe');
    expect(skillContent).toContain('desktop.outputs.create');
    expect(skillContent).toContain('Repository `outputs/index.md`');
    expect(skillContent).toContain(
      'artifact URI, source, updated time, preview, format, summary, preview card, reuse kind, and tags',
    );
    expect(skillContent).toContain('externalFormat');
    expect(skillContent).toContain('reuseKind');
    expect(skillContent).toContain('asset`, `template`, `tool`, `script`, or `workflow`');
    expect(skillContent).toContain('classification and traceability');
    expect(skillContent).toContain('desktop.artifacts.reuse.record');
    expect(skillContent).toContain('records reuse/audit facts only');
    expect(skillContent).toContain('does not execute tools, open files, or grant permissions');
    expect(skillContent).toContain('desktop.artifacts.execution.prepare');
    expect(skillContent).toContain('records an approval-required execution intent');
    expect(skillContent).toContain('desktop.artifacts.execution.record');
    expect(skillContent).toContain('records executable Artifact run facts only');
    expect(skillContent).toContain('tool`, `script`, or `workflow`');
    expect(skillContent).toContain('does not execute commands or grant execution permission');
    expect(skillContent).toContain(
      'Artifacts list search, Dashboard recent Artifacts, and Workbench outputs surface value summaries',
    );
    expect(skillContent).toContain('Repository output / preview clues');
    expect(skillContent).toContain('system file handler');
    expect(skillContent).toContain('imported into Artifact storage');
    expect(skillContent).toContain('Artifact preview card');
    expect(skillContent).toContain('format label, thumbnail label, summary, location, primary action, and safety note');
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
