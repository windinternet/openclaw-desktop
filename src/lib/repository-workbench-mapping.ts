import workbenchSemanticMappingTemplate from '../prompts/repository/workbench-semantic-mapping.md?raw';
import type {
  SemanticConfidence,
  SemanticSlot,
  WorkbenchSemanticMapping,
  WorkbenchSemanticSlots,
} from './agentic-repository';
import { parseModelJsonObjects } from './model-json';
import { renderPromptTemplate } from './prompt-template';

const MAX_SEMANTIC_SLOT_PATHS = 120;
const MAX_PATHS_PER_SLOT = 20;
const UNSAFE_PATH_PATTERN = new RegExp(String.raw`[\s\x00-\x1f\x7f]`);

export interface WorkbenchStructureSignal {
  path: string;
  hints: string[];
}

export interface WorkbenchSemanticMappingResponse {
  isWorkbenchRepository: boolean;
  confidence?: SemanticConfidence;
  reason?: string;
  mapping?: WorkbenchSemanticMapping;
}

export function buildWorkbenchSemanticMappingPrompt(options: {
  repoPath: string;
  tree: string[];
  structureSignals: WorkbenchStructureSignal[];
}): string {
  return renderPromptTemplate(workbenchSemanticMappingTemplate, {
    repoPath: options.repoPath,
    tree: options.tree.map((item) => `- ${item}`).join('\n') || '- （空）',
    structureSignals:
      options.structureSignals.map((item) => `- ${item.path}: ${item.hints.join(', ')}`).join('\n') || '- （无）',
  });
}

export function parseWorkbenchSemanticMappingResponse(text: string): WorkbenchSemanticMappingResponse | null {
  const objects = parseModelJsonObjects(text);
  const latest = objects.at(-1);
  return latest ? parseWorkbenchSemanticMappingResult(latest) : null;
}

function parseWorkbenchSemanticMappingResult(parsed: unknown): WorkbenchSemanticMappingResponse | null {
  if (!isRecord(parsed)) return null;
  const result = isRecord(parsed.result) ? parsed.result : parsed;
  const confidence = normalizeConfidence(result.confidence);
  const reason = stringValue(result.reason);
  if (result.isWorkbenchRepository === false) {
    return { isWorkbenchRepository: false, confidence, reason };
  }
  if (result.isWorkbenchRepository !== true || !isRecord(result.mapping)) return null;
  const mapping = normalizeMapping(result.mapping, confidence, reason);
  if (!mapping) return null;
  return {
    isWorkbenchRepository: true,
    confidence,
    reason,
    mapping,
  };
}

export function sanitizeWorkbenchSemanticMapping(options: {
  mapping: WorkbenchSemanticMapping;
  tree: string[];
}): WorkbenchSemanticMapping | null {
  const validPaths = buildValidPathSet(options.tree);
  const slots = sanitizeSlots(options.mapping.slots, validPaths);
  if (Object.keys(slots).length === 0) return null;
  return {
    ...options.mapping,
    slots,
  };
}

function normalizeMapping(
  value: Record<string, unknown>,
  confidence?: SemanticConfidence,
  reason?: string,
): WorkbenchSemanticMapping | null {
  if (value.mappingSource !== 'agent' || !isRecord(value.slots)) return null;
  const slots = normalizeSlots(value.slots);
  if (Object.keys(slots).length === 0) return null;
  return {
    isWorkbenchRepository: true,
    confidence,
    reason,
    mappingSource: 'agent',
    slots,
  };
}

function normalizeSlots(value: Record<string, unknown>): WorkbenchSemanticSlots {
  const plans = isRecord(value.plans)
    ? {
        active: normalizeSlot(value.plans.active),
        completed: normalizeSlot(value.plans.completed),
      }
    : undefined;
  const slots: WorkbenchSemanticSlots = {
    inbox: normalizeSlot(value.inbox),
    current: normalizeSlot(value.current),
    next: normalizeSlot(value.next),
    done: normalizeSlot(value.done),
    projects: normalizeSlot(value.projects),
    plans: plans && (plans.active || plans.completed) ? plans : undefined,
    runs: normalizeSlot(value.runs),
    outputs: normalizeSlot(value.outputs),
    reviews: normalizeSlot(value.reviews),
    tools: normalizeSlot(value.tools),
    logs: normalizeSlot(value.logs),
  };
  return Object.fromEntries(Object.entries(slots).filter(([, slot]) => Boolean(slot))) as WorkbenchSemanticSlots;
}

function normalizeSlot(value: unknown): SemanticSlot | undefined {
  if (!isRecord(value) || !Array.isArray(value.paths)) return undefined;
  const paths = value.paths
    .filter((item): item is string => typeof item === 'string' && isSafeSemanticSlotPath(item))
    .slice(0, MAX_PATHS_PER_SLOT);
  if (paths.length === 0) return undefined;
  return {
    label: stringValue(value.label)?.slice(0, 80) || 'Workbench section',
    paths,
    kind: value.kind === 'document' || value.kind === 'directory' || value.kind === 'mixed' ? value.kind : 'mixed',
    confidence: normalizeConfidence(value.confidence) ?? 'medium',
    reason: stringValue(value.reason)?.slice(0, 240) || 'Agent semantic mapping.',
  };
}

function sanitizeSlots(slots: WorkbenchSemanticSlots, validPaths: Set<string>): WorkbenchSemanticSlots {
  const budget = { remaining: MAX_SEMANTIC_SLOT_PATHS };
  const sanitized: WorkbenchSemanticSlots = {
    inbox: sanitizeSlot(slots.inbox, validPaths, budget),
    current: sanitizeSlot(slots.current, validPaths, budget),
    next: sanitizeSlot(slots.next, validPaths, budget),
    done: sanitizeSlot(slots.done, validPaths, budget),
    projects: sanitizeSlot(slots.projects, validPaths, budget),
    plans: sanitizePlanSlots(slots.plans, validPaths, budget),
    runs: sanitizeSlot(slots.runs, validPaths, budget),
    outputs: sanitizeSlot(slots.outputs, validPaths, budget),
    reviews: sanitizeSlot(slots.reviews, validPaths, budget),
    tools: sanitizeSlot(slots.tools, validPaths, budget),
    logs: sanitizeSlot(slots.logs, validPaths, budget),
  };
  return Object.fromEntries(Object.entries(sanitized).filter(([, slot]) => Boolean(slot))) as WorkbenchSemanticSlots;
}

function sanitizePlanSlots(
  plans: WorkbenchSemanticSlots['plans'],
  validPaths: Set<string>,
  budget: { remaining: number },
): WorkbenchSemanticSlots['plans'] | undefined {
  if (!plans) return undefined;
  const sanitized = {
    active: sanitizeSlot(plans.active, validPaths, budget),
    completed: sanitizeSlot(plans.completed, validPaths, budget),
  };
  return sanitized.active || sanitized.completed ? sanitized : undefined;
}

function sanitizeSlot(
  slot: SemanticSlot | undefined,
  validPaths: Set<string>,
  budget: { remaining: number },
): SemanticSlot | undefined {
  if (!slot) return undefined;
  if (budget.remaining <= 0) return undefined;
  const paths = slot.paths
    .map((item) => ({ raw: item, normalized: normalizeTreePath(item) }))
    .filter((item) => isSafeSemanticSlotPath(item.raw) && validPaths.has(item.normalized))
    .map((item) => item.normalized)
    .slice(0, Math.min(MAX_PATHS_PER_SLOT, budget.remaining));
  if (paths.length === 0) return undefined;
  budget.remaining -= paths.length;
  return { ...slot, paths };
}

function buildValidPathSet(tree: string[]): Set<string> {
  const values = new Set<string>();
  for (const item of tree) {
    const normalized = normalizeTreePath(item);
    if (!isSafeSemanticSlotPath(normalized)) continue;
    values.add(normalized);
    addParentPaths(values, normalized);
  }
  return values;
}

function addParentPaths(values: Set<string>, path: string): void {
  const parts = path.split('/').filter(Boolean);
  for (let index = 1; index < parts.length; index += 1) {
    values.add(parts.slice(0, index).join('/'));
  }
}

function normalizeTreePath(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function isSafeSemanticSlotPath(value: string): boolean {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/\/+$/, '');
  const segments = normalized.split('/');
  return (
    normalized.length > 0 &&
    trimmed === value &&
    normalized !== '.' &&
    !normalized.startsWith('/') &&
    !normalized.startsWith('./') &&
    !UNSAFE_PATH_PATTERN.test(normalized) &&
    !normalized.includes('..') &&
    !normalized.includes('\\') &&
    segments.every((segment) => segment.length > 0 && segment !== '.')
  );
}

function normalizeConfidence(value: unknown): SemanticConfidence | undefined {
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
