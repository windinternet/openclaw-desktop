import { describe, expect, it } from 'vitest';
import { renderSafeMarkdown } from '../lib/markdown-renderer';

describe('safe markdown renderer', () => {
  it('renders headings, tables, lists, and code blocks', () => {
    const html = renderSafeMarkdown(`
## 执行计划

| 步骤 | 说明 |
| --- | --- |
| 1 | 创建 Agent |

- 检查配置

\`\`\`sh
openclaw agents add product
\`\`\`
`);

    expect(html).toContain('<h2>执行计划</h2>');
    expect(html).toContain('<table>');
    expect(html).toContain('<li>检查配置</li>');
    expect(html).toContain('<code class="language-sh">');
  });

  it('escapes raw html and removes unsafe links', () => {
    const html = renderSafeMarkdown('<script>alert(1)</script> [危险](javascript:alert(1))');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('href="javascript:');
  });
});
