const GENERATED_DASHBOARD_LABEL_SUFFIX_RE = /\s·\s[a-z0-9]{4}$/i;

export function stripGeneratedSessionLabelSuffix(label: string, sessionKey?: string): string {
  if (!sessionKey?.includes(':dashboard:')) return label;
  return label.replace(GENERATED_DASHBOARD_LABEL_SUFFIX_RE, '');
}
