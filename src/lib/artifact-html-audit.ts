import type {
  ArtifactHtmlAudit,
  ArtifactHtmlAuditIssue,
  ArtifactHtmlAuditIssueCode,
  ArtifactHtmlAuditSeverity,
} from './artifact-types';

interface IssueOptions {
  selfContainedRisk?: boolean;
  approvalRequired?: boolean;
}

const remoteUrl = /^(?:https?:)?\/\//i;

export function auditArtifactHtml(html: string, checkedAt = Date.now()): ArtifactHtmlAudit {
  const issues: ArtifactHtmlAuditIssue[] = [];
  let selfContained = true;
  let requiresApproval = false;

  const addIssue = (
    code: ArtifactHtmlAuditIssueCode,
    severity: ArtifactHtmlAuditSeverity,
    message: string,
    detail?: string,
    options: IssueOptions = {},
  ) => {
    issues.push({ code, severity, message, detail });
    if (options.selfContainedRisk) selfContained = false;
    if (options.approvalRequired) requiresApproval = true;
  };

  for (const src of findTagAttributeValues(html, 'script', 'src')) {
    if (isRemoteUrl(src)) {
      addIssue('external-script', 'danger', '引用了外部脚本，HTML 产物不再自包含', src, {
        selfContainedRisk: true,
      });
    }
  }

  for (const href of findTagAttributeValues(html, 'link', 'href')) {
    if (isRemoteUrl(href)) {
      addIssue('external-stylesheet', 'warning', '引用了外部样式或资源，建议内联到 HTML', href, {
        selfContainedRisk: true,
      });
    }
  }

  for (const src of findTagAttributeValues(html, 'img', 'src')) {
    if (isRemoteUrl(src)) {
      addIssue('external-image', 'warning', '引用了外部图片，离线或仓库沉淀时可能失效', src, {
        selfContainedRisk: true,
      });
    }
  }

  for (const src of findTagAttributeValues(html, 'audio|video|source|track|embed|object', 'src')) {
    if (isRemoteUrl(src)) {
      addIssue('external-media', 'warning', '引用了外部媒体资源，离线或仓库沉淀时可能失效', src, {
        selfContainedRisk: true,
      });
    }
  }

  for (const src of findTagAttributeValues(html, 'iframe', 'src')) {
    addIssue('external-frame', 'danger', '包含 iframe；预览运行时默认不允许嵌入外部页面', src, {
      selfContainedRisk: true,
    });
  }

  for (const href of findCssImports(html)) {
    addIssue('external-css-import', 'warning', 'CSS 使用了外部 @import，建议内联样式', href, {
      selfContainedRisk: true,
    });
  }

  for (const url of findCssRemoteUrls(html)) {
    addIssue('external-css-url', 'warning', 'CSS 使用了外部 url() 资源，建议改为内联或 data URL', url, {
      selfContainedRisk: true,
    });
  }

  if (hasDirectNetworkCall(html)) {
    addIssue('direct-network', 'danger', '使用了直接网络请求；需要走 Desktop Bridge 和审批边界', undefined, {
      selfContainedRisk: true,
      approvalRequired: true,
    });
  }

  const bridgeChecks: Array<{
    method: string;
    code: ArtifactHtmlAuditIssueCode;
    severity: ArtifactHtmlAuditSeverity;
    message: string;
  }> = [
    {
      method: 'fetch',
      code: 'bridge-network-fetch',
      severity: 'warning',
      message: '使用了 Desktop Bridge 网络能力，运行时需要审批',
    },
    {
      method: 'readFile',
      code: 'bridge-file-read',
      severity: 'danger',
      message: '使用了 Desktop Bridge 文件读取能力，运行时需要审批',
    },
    {
      method: 'writeFile',
      code: 'bridge-file-write',
      severity: 'danger',
      message: '使用了 Desktop Bridge 文件写入能力，运行时需要审批',
    },
    {
      method: 'exec',
      code: 'bridge-shell-exec',
      severity: 'danger',
      message: '使用了 Desktop Bridge 命令执行能力，运行时需要审批',
    },
    {
      method: 'exportAs',
      code: 'bridge-export',
      severity: 'warning',
      message: '使用了 Desktop Bridge 导出能力，运行时需要审批',
    },
    {
      method: 'notify',
      code: 'bridge-notification',
      severity: 'warning',
      message: '使用了 Desktop Bridge 通知能力，运行时需要审批',
    },
  ];

  for (const check of bridgeChecks) {
    if (usesArtifactBridgeMethod(html, check.method)) {
      addIssue(check.code, check.severity, check.message, check.method, { approvalRequired: true });
    }
  }

  return {
    selfContained,
    requiresApproval,
    issues,
    checkedAt,
  };
}

function findTagAttributeValues(html: string, tagPattern: string, attribute: string): string[] {
  const pattern = new RegExp(
    `<(?:${tagPattern})\\b[^>]*\\b${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'gi',
  );
  const values: string[] = [];
  for (const match of html.matchAll(pattern)) {
    values.push((match[2] ?? match[3] ?? match[4] ?? '').trim());
  }
  return values;
}

function findCssImports(html: string): string[] {
  return collectRegexGroup(html, /@import\s+(?:url\(\s*)?["']?((?:https?:)?\/\/[^"')\s;]+)/gi);
}

function findCssRemoteUrls(html: string): string[] {
  return collectRegexGroup(html, /url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)["']?\s*\)/gi);
}

function collectRegexGroup(text: string, pattern: RegExp): string[] {
  const values: string[] = [];
  for (const match of text.matchAll(pattern)) {
    values.push(match[1].trim());
  }
  return values;
}

function hasDirectNetworkCall(html: string): boolean {
  return (
    /\bfetch\s*\(\s*["'](?:https?:)?\/\//i.test(html) ||
    /\bXMLHttpRequest\s*\(/i.test(html) ||
    /\bnew\s+WebSocket\s*\(\s*["'](?:wss?:|https?:)?\/\//i.test(html) ||
    /\bnew\s+EventSource\s*\(\s*["'](?:https?:)?\/\//i.test(html)
  );
}

function usesArtifactBridgeMethod(html: string, method: string): boolean {
  return new RegExp(`\\bartifactBridge\\s*(?:\\?\\.|\\.)\\s*${method}\\s*\\(`, 'i').test(html);
}

function isRemoteUrl(value: string): boolean {
  return remoteUrl.test(value.trim());
}
