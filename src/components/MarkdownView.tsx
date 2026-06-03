import { useMemo } from 'react';
import { renderSafeMarkdown, stripAiActionProtocolBlocks } from '../lib/markdown-renderer';

export default function MarkdownView({
  content,
  showProtocolBlocks = false,
}: {
  content: string;
  showProtocolBlocks?: boolean;
}) {
  const html = useMemo(
    () => renderSafeMarkdown(showProtocolBlocks ? content : stripAiActionProtocolBlocks(content)),
    [content, showProtocolBlocks],
  );

  return <div className="action-markdown-viewer" dangerouslySetInnerHTML={{ __html: html }} />;
}
