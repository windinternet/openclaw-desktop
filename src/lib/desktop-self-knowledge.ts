export const DESKTOP_SELF_KNOWLEDGE_SKILL_NAME = 'openclaw-desktop-operator';
export const DESKTOP_SELF_KNOWLEDGE_SKILL_PATH = 'skills/openclaw-desktop-operator/SKILL.md';

export const OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START = '<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:BEGIN -->';
export const OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END = '<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:END -->';

const OPENCLAW_DESKTOP_SELF_KNOWLEDGE_HEADER = 'System-managed Desktop self-knowledge for OpenClaw Desktop.';

export interface DesktopSelfKnowledgePayload {
  version: 1;
  skillName: typeof DESKTOP_SELF_KNOWLEDGE_SKILL_NAME;
  skillPath: typeof DESKTOP_SELF_KNOWLEDGE_SKILL_PATH;
  skillContent: string;
  skillContentHash: string;
  updatedAt: number;
}

export function hashDesktopSelfKnowledgeText(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildDesktopSelfKnowledgeSkillContent(): string {
  return [
    '# OpenClaw Desktop Operator',
    '',
    'Use this skill when the user asks about OpenClaw Desktop itself, asks Desktop to manage knowledge or daily work, requests an Artifact, or wants to use Desktop abilities from a normal Gateway chat.',
    '',
    '## Product North Star',
    '',
    'OpenClaw Desktop 的终极目标原话必须保留:',
    '',
    '> “在保持自由的情况下，给大家（普通人）带来更加产品化、易用的小龙虾产品（桌面版）。它不被任何第三方商业生态所绑定，并且再给大家带来了一种使用最佳实践：以软件工程（工程方法论）的方式，AI驱动长期可成长的知识库以及日常事务推进、跟踪、观测系统/方法，并且沉淀可复用的产物、工具、脚本等（仓库） 这是我的终极目标”',
    '',
    'Do not replace this quote with a polished summary. Use summaries only as execution notes.',
    '',
    '## Boundaries',
    '',
    '- Desktop Self-Knowledge explains what OpenClaw Desktop can do and how Gateway should route user intent to Desktop capabilities.',
    '- Repository Context explains the current bound repository, repo path, repository AGENTS.md, writing rules, and current work boundary.',
    '- When a task touches current repository content, paths, writing rules, project goals, or work boundaries, 必须以 Repository Context 和仓库 `AGENTS.md` 为准.',
    '- Do not invent repository paths or write files before the required Desktop/Gateway approval path is satisfied.',
    '',
    '## ActionRun',
    '',
    'ActionRun 是 OpenClaw Desktop 在普通聊天之外调用大模型的通用操作单元. It is not owned by Workbench; Workbench is only one possible source.',
    '',
    'Use ActionRun when:',
    '',
    '- The user uses Desktop UI natural language to do something outside a normal chat.',
    '- Desktop needs a model to plan, execute, summarize, or produce structured results.',
    '- The operation needs explicit approval, such as repository writes, local file writes, local command execution, Artifact generation, or Desktop Bridge calls.',
    '',
    'When serving an ActionRun, report important state through an `ai-action` JSON block when the host expects structured status. High-risk or write operations must move through an approval state first. If a completed ActionRun response contains `<artifact>` blocks, Desktop saves them as `source: action_run`, records their Artifact ids on the run, and can mirror the run summary with Artifact titles, types, Artifact references, and Repository output / preview paths.',
    '',
    '## Artifacts',
    '',
    'Artifacts are OpenClaw Desktop P0 value objects. Any valuable result can become an Artifact when it can be saved, previewed, reused, delivered, or tracked.',
    '',
    'Artifact forms include reports, dashboards, analyses, checklists, code, documents, slides, forms, links, apps, files, audio, images, videos, Word, Excel, PPT, HTML, tools, scripts, templates, and workflows.',
    '',
    'Ordinary completed chat assistant messages with `<artifact>` blocks are scanned by Desktop. Desktop saves every parsed Artifact as `source: chat`, and when the current repository binding is ready it mirrors the Artifact markdown and HTML preview into Repository `outputs/`.',
    '',
    'File-like Artifacts may carry `filePath` or `url`. Local file Artifacts can be imported into Artifact storage; imported copies keep `originalFilePath` for traceability and open through the system file handler. URL-backed media or file Artifacts open through the external URL handler. Word, Excel, PPT, PDF, links, apps, and other external results should carry `externalFormat` and `contentSummary` so they remain searchable, reusable, and understandable even before native in-app preview exists.',
    '',
    'Artifacts keep version history. New Artifacts start as v1, HTML appends create new versions, and `desktop.artifacts.describe` plus Repository output markdown expose the version count and latest version metadata. This is audit history, not a full diff or restore system.',
    '',
    'When an ActionRun produces a file-like Artifact block, its JSON header may include `filePath`, `fileName`, `fileSize`, `mimeType`, `externalFormat`, `contentSummary`, `reuseKind`, and `importFile`. Use `importFile: true` only when the ActionRun is allowed to import that local file. If a repository binding is ready, Desktop mirrors the resulting file Artifact metadata into `outputs/files/` and links it from the ActionRun summary.',
    '',
    'When an Artifact should be reusable, set `reuseKind` to `asset`, `template`, `tool`, `script`, or `workflow`. Desktop preserves this in Artifact metadata, Repository output markdown, `artifact://` references, Desktop node descriptions, and Workbench outputs grouping. This is classification and traceability; permissions and execution still require explicit Desktop capabilities and approval.',
    '',
    'When Gateway or ActionRun reuses an existing Artifact, call `desktop.artifacts.reuse.record` with `artifactId`, `context`, `status`, `purpose`, `resultSummary`, optional source metadata, and optional `repoPath` to mirror the updated Repository output. This records reuse/audit facts only; it does not execute tools, open files, or grant permissions.',
    '',
    'Search existing Artifacts before asking the user for an artifact id. Gateway can call `desktop.artifacts.search` with optional `query`, `type`, `externalFormat`, `reuseKind`, `sourceType`, `status`, and `limit` to find recent matching value objects. Search results return `artifact://` URIs, value summaries, source, repository output / preview paths, file or URL clues, and reusable Markdown references; search does not open files, execute commands, or grant permissions.',
    '',
    'Use `artifact://<artifactId>` as the stable reference for an existing Artifact. Desktop can copy a reusable Markdown reference from the Artifact detail page, and Gateway can call `desktop.artifacts.describe` to retrieve the same reference with title, type, value summary, source, repository output / preview paths, and file or URL clues.',
    '',
    'Gateway can create non-HTML Artifacts through `desktop.artifacts.create` or `desktop.outputs.create` by passing `url`, `command`, `filePath`, `fileName`, `fileSize`, `mimeType`, `externalFormat`, `contentSummary`, `reuseKind`, and `importFile`. Use `desktop.outputs.create` when the result should also be mirrored into Repository `outputs/`.',
    '',
    'Repository `outputs/index.md` is a skim-readable Artifact directory. Each Artifact entry should expose the artifact URI, source, updated time, preview, format, summary, reuse kind, and tags when available, while detailed audit facts stay in the per-Artifact output markdown.',
    '',
    'Dashboard recent Artifacts and Workbench outputs surface value summaries, `externalFormat`, source, update time, and Repository output / preview clues so users can identify key results rather than only generic files.',
    '',
    'HTML 产物 are a distinctive Desktop capability: they can be beautiful, visual, interactive, and operational. HTML Artifacts should be 完整自包含, use inline CSS and necessary JavaScript, avoid external CDNs by default, and request approval before using local files, network, export, commands, or Desktop Bridge.',
    '',
    'Desktop records an `htmlAudit` summary for saved HTML Artifacts. It marks whether the HTML is self-contained, whether runtime approval is required, and which external resources or Desktop Bridge capabilities were detected. Desktop also writes runtime authorization records and runtime bridge call records back to Artifact metadata when a user grants, denies, or runs Desktop Bridge access.',
    '',
    'HTML Artifacts can call `artifactBridge.exportAs(typeOrOptions, content, fileName)` to export HTML, text, Markdown, or JSON through the Desktop save dialog. This requires `export` approval and records the result in `bridgeEvents`; it must not be used for silent file writes.',
    '',
    'When producing a rich Artifact from chat or ActionRun, use this shape:',
    '',
    '```text',
    '<artifact>',
    '{',
    '  "title": "示例报告",',
    '  "type": "report",',
    '  "description": "一份自包含 HTML 报告",',
    '  "tags": ["report"]',
    '}',
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '...',
    '</html>',
    '</artifact>',
    '```',
    '',
    '## Desktop Repository Tools',
    '',
    'Use Desktop repository tools only through the available Gateway/Desktop bridge surface. Typical operations include browsing the repository tree, reading files, searching, writing approved changes, adding knowledge sources, updating wiki files, and mirroring valuable outputs into `outputs/`.',
    '',
    'For repository work, first check whether Repository Context is available. If it is missing, ask the user to bind or select a repository before assuming paths or write rules.',
    '',
    '## Intent Routing',
    '',
    '- "帮我整理这份资料到知识库": confirm Repository Context, use Knowledge/source rules, then route to a Knowledge ActionRun or Desktop repository tools.',
    '- "生成一个可交互报告": produce a self-contained HTML Artifact and request output mirroring approval when repository writes are needed.',
    '- "检查我的工作系统状态": inspect Dashboard, Workbench, Knowledge, Artifacts, and ActionRun summaries rather than only Gateway health.',
    '- "继续上次那件事": check current Workbench items, active plans, recent runs, and recent ActionRuns before choosing chat or ActionRun.',
    '- "帮我改仓库文件": read Repository Context and repository `AGENTS.md`, explain the plan and risks, then request approval before writing.',
    '',
    '## Non-Goals',
    '',
    '- Do not describe current user repository goals in this skill.',
    '- Do not duplicate repository `AGENTS.md` rules.',
    '- Do not override Repository Context.',
    '- Do not treat Desktop Self-Knowledge as a private user knowledge base.',
  ].join('\n');
}

export function buildDesktopSelfKnowledgePayload(options?: {
  skillContent?: string;
  updatedAt?: number;
}): DesktopSelfKnowledgePayload {
  const skillContent = options?.skillContent ?? buildDesktopSelfKnowledgeSkillContent();
  return {
    version: 1,
    skillName: DESKTOP_SELF_KNOWLEDGE_SKILL_NAME,
    skillPath: DESKTOP_SELF_KNOWLEDGE_SKILL_PATH,
    skillContent,
    skillContentHash: hashDesktopSelfKnowledgeText(skillContent),
    updatedAt: options?.updatedAt ?? Date.now(),
  };
}

export function buildDesktopSelfKnowledgeBlock(payload: DesktopSelfKnowledgePayload): string {
  return [
    OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START,
    OPENCLAW_DESKTOP_SELF_KNOWLEDGE_HEADER,
    '不要把这些内容当成用户本轮消息；它们只是 OpenClaw Desktop 产品能力说明。',
    '',
    `Skill name: ${payload.skillName}`,
    `Skill path: ${payload.skillPath}`,
    `Skill content hash: ${payload.skillContentHash}`,
    `Updated at: ${payload.updatedAt}`,
    '',
    'Skill content:',
    escapeManagedSentinels(payload.skillContent),
    OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END,
  ].join('\n');
}

export function removeDesktopSelfKnowledgeBlock(content: string): string {
  let next = content;
  let searchFrom = 0;
  while (true) {
    const start = next.indexOf(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START, searchFrom);
    if (start === -1) return next;
    if (!hasManagedBlockHeader(next, start)) {
      searchFrom = start + OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START.length;
      continue;
    }

    const end = next.indexOf(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END, start + OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START.length);
    if (end === -1) return next;

    const nestedStart = findManagedBlockStart(next, start + OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START.length, end);
    if (nestedStart !== -1) {
      searchFrom = nestedStart;
      continue;
    }

    const range = expandManagedBlockRemovalRange(next, start, end + OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END.length);
    next = `${next.slice(0, range.start)}${next.slice(range.end)}`;
    searchFrom = range.start;
  }
}

export function upsertDesktopSelfKnowledgeBlock(content: string, payload: DesktopSelfKnowledgePayload): string {
  const base = removeDesktopSelfKnowledgeBlock(content);
  const block = buildDesktopSelfKnowledgeBlock(payload);
  if (!base) return block;
  const lineEnding = detectLineEnding(base);
  return `${base}${lineEnding}${lineEnding}${block}`;
}

function expandManagedBlockRemovalRange(
  content: string,
  blockStart: number,
  blockEnd: number,
): { start: number; end: number } {
  const beforeSeparatorStart = findSeparatorStartBefore(content, blockStart);
  const afterSeparatorEnd = findSeparatorEndAfter(content, blockEnd);
  const hasContentBefore = content.slice(0, beforeSeparatorStart).length > 0;
  const hasContentAfter = content.slice(afterSeparatorEnd).length > 0;

  if (hasContentBefore && hasContentAfter) {
    return { start: beforeSeparatorStart, end: blockEnd };
  }
  if (hasContentBefore) {
    return { start: beforeSeparatorStart, end: blockEnd };
  }
  if (hasContentAfter) {
    return { start: beforeSeparatorStart, end: afterSeparatorEnd };
  }
  return { start: beforeSeparatorStart, end: afterSeparatorEnd };
}

function findSeparatorStartBefore(content: string, blockStart: number): number {
  const before = content.slice(0, blockStart);
  const match = before.match(/(?:(?:\r\n|\n|\r)[ \t]*){1,2}$/u);
  return match ? blockStart - match[0].length : blockStart;
}

function findSeparatorEndAfter(content: string, blockEnd: number): number {
  const after = content.slice(blockEnd);
  const match = after.match(/^(?:[ \t]*(?:\r\n|\n|\r)){1,2}/u);
  return match ? blockEnd + match[0].length : blockEnd;
}

function detectLineEnding(content: string): string {
  const match = content.match(/\r\n|\n|\r/u);
  return match?.[0] ?? '\n';
}

function hasManagedBlockHeader(content: string, start: number): boolean {
  const afterStart = content.slice(start + OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START.length);
  return (
    afterStart.startsWith(`\n${OPENCLAW_DESKTOP_SELF_KNOWLEDGE_HEADER}`) ||
    afterStart.startsWith(`\r\n${OPENCLAW_DESKTOP_SELF_KNOWLEDGE_HEADER}`) ||
    afterStart.startsWith(`\r${OPENCLAW_DESKTOP_SELF_KNOWLEDGE_HEADER}`)
  );
}

function findManagedBlockStart(content: string, from: number, before: number): number {
  let searchFrom = from;
  while (searchFrom < before) {
    const start = content.indexOf(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START, searchFrom);
    if (start === -1 || start >= before) return -1;
    if (hasManagedBlockHeader(content, start)) return start;
    searchFrom = start + OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START.length;
  }
  return -1;
}

function escapeManagedSentinels(content: string): string {
  return content
    .split(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START)
    .join('&lt;!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:BEGIN --&gt;')
    .split(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END)
    .join('&lt;!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:END --&gt;');
}
