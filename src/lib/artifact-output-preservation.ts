import { parseArtifactsFromText, type ParsedArtifact } from './artifact-parser';

const OUTPUT_SECTION_PATTERN =
  /^(?:#{1,6}\s*)?(?:\*\*)?\s*(成果|产物|输出|交付物|deliverables?|artifacts?|outputs?|files?|links?)(?:\*\*)?\s*[:：]?\s*$/i;
const INLINE_OUTPUT_PATTERN =
  /^(成果|产物|输出|交付物|deliverables?|artifacts?|outputs?|files?|links?)\s*[:：]\s*(.+)$/i;
const MARKDOWN_HEADER_PATTERN = /^#{1,6}\s+\S+/;
const FILE_OR_URL_PATTERN =
  /(https?:\/\/\S+|\b[\w./@-]+\.(?:html?|md|pdf|docx?|xlsx?|pptx?|csv|txt|json|png|jpe?g|gif|svg|mp4|mov|mp3|wav|zip)\b)/i;

export interface ArtifactOutputPreservationPromptInput {
  workItemPath?: string;
  actionRunOutputId?: string;
  assetRunPath?: string;
  assetRunMarkdown?: string;
  resultSummary?: string;
  assistantResponse?: string;
  candidateLimit?: number;
}

export function extractActionRunOutputCandidates(candidateText: string | undefined, limit = 6): string[] {
  if (!candidateText?.trim()) return [];
  const candidates: string[] = [];
  const seen = new Set<string>();
  let inOutputSection = false;

  for (const artifact of parseArtifactsFromText(candidateText)) {
    addCandidate(formatParsedArtifactCandidate(artifact), candidates, seen, limit);
    if (candidates.length >= limit) return candidates;
  }

  for (const rawLine of candidateText.split('\n')) {
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

    if (inOutputSection || (FILE_OR_URL_PATTERN.test(line) && !isInternalRepositoryReference(line))) {
      addCandidate(line, candidates, seen, limit);
      if (candidates.length >= limit) break;
    }
  }

  return candidates;
}

export function buildArtifactOutputPreservationPrompt(input: ArtifactOutputPreservationPromptInput): string {
  const resultSummary = normalizeBlock(input.resultSummary, 1200);
  const candidateSource = [input.resultSummary, input.assistantResponse, input.assetRunMarkdown]
    .filter(Boolean)
    .join('\n');
  const candidates = extractActionRunOutputCandidates(candidateSource, input.candidateLimit);
  const sourceIntro = input.workItemPath
    ? `请根据来源事项 ${input.workItemPath} 和最近执行记录，判断本次执行中值得沉淀的成果。`
    : '请根据来源资产运行和最近执行记录，判断本次执行中值得沉淀的成果。';
  const sourceReferenceText = input.workItemPath
    ? '请在产物说明中保留来源事项、来源执行记录和价值摘要。'
    : '请在产物说明中保留来源资产运行、来源执行记录和价值摘要。';
  return [
    sourceIntro,
    input.actionRunOutputId ? `来源执行记录 ${input.actionRunOutputId}。` : undefined,
    input.assetRunPath ? `来源资产运行 ${input.assetRunPath}。` : undefined,
    resultSummary ? `最近执行结果摘要：\n${resultSummary}` : undefined,
    candidates.length ? `候选成果：\n${candidates.map((candidate) => `- ${candidate}`).join('\n')}` : undefined,
    '如果适合沉淀，请生成一个可保存、可复用、可追踪的产物；优先考虑 HTML 报告/仪表盘、文档、链接或文件型成果。',
    sourceReferenceText,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatParsedArtifactCandidate(artifact: ParsedArtifact): string {
  return [
    artifact.title,
    artifact.externalFormat ?? artifact.type,
    artifact.fileName ?? artifact.filePath ?? artifact.url,
    artifact.contentSummary ?? artifact.description,
  ]
    .filter(Boolean)
    .join(' · ');
}

function addCandidate(rawValue: string, candidates: string[], seen: Set<string>, limit: number): void {
  const candidate = normalizeCandidate(rawValue);
  if (!candidate || seen.has(candidate)) return;
  seen.add(candidate);
  candidates.push(candidate);
  if (candidates.length > limit) candidates.length = limit;
}

function normalizeCandidate(value: string): string {
  const normalized = value
    .replace(/^[-*+]\s+(?:\[[ xX]\]\s*)?/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const markdownLink = /^\[([^\]]+)]\(([^)]+)\)\s*(.*)$/.exec(normalized);
  if (markdownLink) {
    const description = markdownLink[3].replace(/^\s*[-:：]\s*/, '').trim();
    return [markdownLink[1].trim(), markdownLink[2].trim(), description].filter(Boolean).join(' · ').slice(0, 180);
  }
  return normalized.slice(0, 180);
}

function isInternalRepositoryReference(value: string): boolean {
  const candidate = extractMarkdownLinkHref(value) ?? value;
  return /(^|[(\s])(?:work|plans|runs|reviews|wiki|sources)\//i.test(candidate);
}

function extractMarkdownLinkHref(value: string): string | undefined {
  return /\[[^\]]+]\(([^)]+)\)/.exec(value)?.[1]?.trim();
}

function normalizeBlock(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim().replace(/\n{3,}/g, '\n\n');
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}\n...`;
}
