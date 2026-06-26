export function parseModelJsonObject(text: string): unknown | null {
  for (const candidate of extractJsonCandidates(text)) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function parseModelJsonObjects(text: string): unknown[] {
  return extractJsonCandidates(text)
    .map(parseJsonCandidate)
    .filter((item): item is unknown => item !== null);
}

function extractJsonCandidates(text: string): string[] {
  const candidates = Array.from(text.matchAll(/```(?:ai-action|json)?\s*([\s\S]*?)```/gi))
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (candidates.length > 0) return candidates;
  const bare = extractBareJsonObject(text);
  return bare ? [bare] : [];
}

function extractBareJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseJsonCandidate(candidate: string): unknown | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(repairUnescapedStringQuotes(trimmed));
    } catch {
      return null;
    }
  }
}

function repairUnescapedStringQuotes(value: string): string {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!inString) {
      output += char;
      if (char === '"') inString = true;
      continue;
    }
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      output += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      if (looksLikeStringTerminator(value, index)) {
        output += char;
        inString = false;
      } else {
        output += '\\"';
      }
      continue;
    }
    output += char;
  }
  return output;
}

function looksLikeStringTerminator(value: string, quoteIndex: number): boolean {
  for (let index = quoteIndex + 1; index < value.length; index += 1) {
    const char = value[index];
    if (/\s/.test(char)) continue;
    return char === ':' || char === ',' || char === '}' || char === ']';
  }
  return true;
}
