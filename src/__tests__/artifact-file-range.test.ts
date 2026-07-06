import { describe, expect, it } from 'vitest';
import { resolveArtifactFileRangeRequest } from '../lib/artifact-file-range';

describe('artifact file range requests', () => {
  it('parses bounded, open-ended, and suffix byte ranges for imported file streaming', () => {
    expect(resolveArtifactFileRangeRequest(1000, 'bytes=100-199')).toEqual({
      kind: 'range',
      start: 100,
      end: 199,
      length: 100,
      contentRange: 'bytes 100-199/1000',
    });

    expect(resolveArtifactFileRangeRequest(1000, 'bytes=900-')).toEqual({
      kind: 'range',
      start: 900,
      end: 999,
      length: 100,
      contentRange: 'bytes 900-999/1000',
    });

    expect(resolveArtifactFileRangeRequest(1000, 'bytes=-128')).toEqual({
      kind: 'range',
      start: 872,
      end: 999,
      length: 128,
      contentRange: 'bytes 872-999/1000',
    });
  });

  it('marks invalid or unsatisfiable ranges without reading arbitrary bytes', () => {
    expect(resolveArtifactFileRangeRequest(1000, undefined)).toEqual({ kind: 'full' });
    expect(resolveArtifactFileRangeRequest(1000, 'items=1-2')).toEqual({
      kind: 'unsatisfiable',
      contentRange: 'bytes */1000',
    });
    expect(resolveArtifactFileRangeRequest(1000, 'bytes=1000-1200')).toEqual({
      kind: 'unsatisfiable',
      contentRange: 'bytes */1000',
    });
    expect(resolveArtifactFileRangeRequest(1000, 'bytes=200-100')).toEqual({
      kind: 'unsatisfiable',
      contentRange: 'bytes */1000',
    });
  });
});
