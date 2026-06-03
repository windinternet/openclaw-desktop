import { marked, Renderer } from 'marked';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  return null;
}

const renderer = new Renderer();

renderer.html = ({ text }) => escapeHtml(text);
renderer.link = function link({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const safe = safeHref(href);
  if (!safe) return text;
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${escapeHtml(safe)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};
renderer.image = ({ href, title, text }) => {
  const safe = safeHref(href);
  if (!safe) return escapeHtml(text);
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${titleAttr}>`;
};

export function stripAiActionProtocolBlocks(markdown: string): string {
  return markdown.replace(/```ai-action\s*[\s\S]*?```/gi, '').trim();
}

export function renderSafeMarkdown(markdown: string): string {
  return marked.parse(markdown, {
    async: false,
    gfm: true,
    renderer,
  });
}
