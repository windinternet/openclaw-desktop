export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => values[key.trim()] ?? '');
}
