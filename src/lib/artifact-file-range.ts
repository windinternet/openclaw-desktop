export type ArtifactFileRangeRequest =
  | { kind: 'full' }
  | {
      kind: 'range';
      start: number;
      end: number;
      length: number;
      contentRange: string;
    }
  | {
      kind: 'unsatisfiable';
      contentRange: string;
    };

export function resolveArtifactFileRangeRequest(
  fileSize: number,
  rangeHeader?: string | null,
): ArtifactFileRangeRequest {
  if (!rangeHeader?.trim()) return { kind: 'full' };

  const size = Math.max(0, Math.floor(fileSize));
  const contentRange = `bytes */${size}`;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || size <= 0) return { kind: 'unsatisfiable', contentRange };

  const [, startPart, endPart] = match;
  if (!startPart && !endPart) return { kind: 'unsatisfiable', contentRange };

  let start: number;
  let end: number;

  if (!startPart) {
    const suffixLength = Number.parseInt(endPart, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { kind: 'unsatisfiable', contentRange };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number.parseInt(startPart, 10);
    end = endPart ? Number.parseInt(endPart, 10) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { kind: 'unsatisfiable', contentRange };
    end = Math.min(end, size - 1);
  }

  if (start < 0 || start >= size || end < start) return { kind: 'unsatisfiable', contentRange };

  return {
    kind: 'range',
    start,
    end,
    length: end - start + 1,
    contentRange: `bytes ${start}-${end}/${size}`,
  };
}
