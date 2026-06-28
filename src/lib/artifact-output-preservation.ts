const OUTPUT_SECTION_PATTERN =
  /^(?:#{1,6}\s*)?(?:\*\*)?\s*(成果|产物|输出|交付物|deliverables?|artifacts?|outputs?|files?|links?)(?:\*\*)?\s*[:：]?\s*$/i;
const INLINE_OUTPUT_PATTERN =
  /^(成果|产物|输出|交付物|deliverables?|artifacts?|outputs?|files?|links?)\s*[:：]\s*(.+)$/i;
const MARKDOWN_HEADER_PATTERN = /^#{1,6}\s+\S+/;
const FILE_OR_URL_PATTERN =
  /(https?:\/\/\S+|\b[\w./@-]+\.(?:html?|md|pdf|docx?|xlsx?|pptx?|csv|txt|json|png|jpe?g|gif|svg|mp4|mov|mp3|wav|zip)\b)/i;

export interface ArtifactOutputPreservationPromptInput {
  workItemPath: string;
  actionRunOutputId?: string;
  resultSummary?: string;
  candidateLimit?: number;
}

export function extractActionRunOutputCandidates(resultSummary: string | undefined, limit = 6): string[] {
  if (!resultSummary?.trim()) return [];
  const candidates: string[] = [];
  const seen = new Set<string>();
  let inOutputSection = false;

  for (const rawLine of resultSummary.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const inlineOutput = INLINE_OUTPUT_PATTERN.exec(line);
    if (inlineOutput?.[2]?.trim()) {
      inOutputSection = true;
      addCandidate(inlineOutput[2], candidates, seen, limit);
      if (candidates.length >= limit) break;
      continue;
    }

    if (OUTPUT_SECTION_PATTERN.test(line)) {
      inOutputSection = true;
      continue;
    }

    if (MARKDOWN_HEADER_PATTERN.test(line)) {
      inOutputSection = false;
      continue;
    }

    if (inOutputSection || FILE_OR_URL_PATTERN.test(line)) {
      addCandidate(line, candidates, seen, limit);
      if (candidates.length >= limit) break;
    }
  }

  return candidates;
}

export function buildArtifactOutputPreservationPrompt(input: ArtifactOutputPreservationPromptInput): string {
  const resultSummary = normalizeBlock(input.resultSummary, 1200);
  const candidates = extractActionRunOutputCandidates(input.resultSummary, input.candidateLimit);
  return [
    `请根据来源事项 ${input.workItemPath} 和最近执行记录，判断本次执行中值得沉淀的成果。`,
    input.actionRunOutputId ? `来源执行记录 ${input.actionRunOutputId}。` : undefined,
    resultSummary ? `最近执行结果摘要：\n${resultSummary}` : undefined,
    candidates.length ? `候选成果：\n${candidates.map((candidate) => `- ${candidate}`).join('\n')}` : undefined,
    '如果适合沉淀，请生成一个可保存、可复用、可追踪的产物；优先考虑 HTML 报告/仪表盘、文档、链接或文件型成果。',
    '请在产物说明中保留来源事项、来源执行记录和价值摘要。',
  ]
    .filter(Boolean)
    .join('\n');
}

function addCandidate(rawValue: string, candidates: string[], seen: Set<string>, limit: number): void {
  const candidate = normalizeCandidate(rawValue);
  if (!candidate || seen.has(candidate)) return;
  seen.add(candidate);
  candidates.push(candidate);
  if (candidates.length > limit) candidates.length = limit;
}

function normalizeCandidate(value: string): string {
  return value
    .replace(/^[-*+]\s+(?:\[[ xX]\]\s*)?/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function normalizeBlock(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim().replace(/\n{3,}/g, '\n\n');
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}\n...`;
}
