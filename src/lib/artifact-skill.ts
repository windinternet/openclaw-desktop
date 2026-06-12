import type { GatewayClient } from './gateway';

const SKILL_CONTENT = `---
name: artifact-generator
description: Generate rich HTML artifacts (reports, dashboards, analyses, checklists) with interactive presentation.
---

# Artifact Generator

When the user asks you to produce a report, dashboard, data analysis, checklist,
slide deck, code document, or any structured output that would benefit from rich
HTML presentation, use the \`artifact\` wrapper format described below.

## Output format

Wrap your artifact in an \`<artifact>\` XML block with a JSON header and HTML body:

\`\`\`
<artifact>
{
  "title": "Q2 Sales Analysis",
  "type": "report",
  "icon": "📊",
  "description": "Q2 sales performance analysis with key metrics",
  "tags": ["sales", "Q2"]
}
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>Q2 Sales Analysis</title>
<style>
  /* your CSS here */
</style></head>
<body>
  <!-- your HTML here -->
</body></html>
</artifact>
\`\`\`

## Rules

1. **Always use \`<artifact>\` wrapper** when generating reports, dashboards,
   analyses, checklists, code documents, slide decks, or forms.
2. The JSON header must contain: \`title\` (required), \`type\` (one of:
   report, dashboard, analysis, checklist, code, document, slide, form, other),
   \`icon\` (emoji), \`description\` (optional), \`tags\` (optional string array).
3. The HTML must be a complete, self-contained document including CSS styles
   (inline or in \`<style>\` tags). NO external resource dependencies.
4. For interactive elements (tabs, charts, collapsible sections), use vanilla
   JavaScript inside \`<script>\` tags.
5. For reports: include title, metadata, summary, body sections, and footer.
6. For dashboards: include metric cards, charts (use inline SVG or Canvas),
   and summary sections.
7. For checklists: make items clickable to toggle checked/unchecked state.
8. Use clean, modern design with appropriate typography and spacing.
9. **Do NOT** use external CSS frameworks or CDN links — everything must be
   self-contained.
10. After outputting the artifact block, briefly summarize what was generated.
`;

export async function writeArtifactSkill(client: GatewayClient): Promise<void> {
  // 优先通过 IPC 直接写本地文件（Gateway 在本地时最可靠）
  const api = (window as unknown as { electronAPI?: { artifact?: {
    writeSkill: (dummy: string, content: string) => Promise<void>;
  } } }).electronAPI?.artifact;

  if (api) {
    try {
      await api.writeSkill('_', SKILL_CONTENT);
      console.log('[Artifact Skill] Written locally');
      return;
    } catch (e) {
      console.warn('[Artifact Skill] Local write failed, trying RPC:', e);
    }
  }

  // 回退：通过 Gateway RPC
  try {
    const result = await client.request<unknown>('agents.files.set', {
      agentId: 'main',
      name: 'skills/artifact-generator/SKILL.md',
      content: SKILL_CONTENT,
    });
    console.log('[Artifact Skill] Written via RPC:', result);
  } catch (e) {
    console.error('[Artifact Skill] RPC also failed:', e);
  }
}
