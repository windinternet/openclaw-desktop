import { describe, expect, it } from 'vitest';
import { extractSvgTextFromBuffer } from '../../electron/svg-text-extract';

describe('svg text extract', () => {
  it('extracts title desc and text elements from SVG content', () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<title>System Map</title>',
      '<desc>Repository knowledge flow</desc>',
      '<text x="10" y="20">Import Queue</text>',
      '<text x="10" y="40"><tspan>Digest</tspan><tspan>Review</tspan></text>',
      '</svg>',
    ].join('');

    expect(extractSvgTextFromBuffer(new TextEncoder().encode(svg))).toEqual({
      text: ['System Map', 'Repository knowledge flow', 'Import Queue', 'Digest Review'].join('\n'),
      bytesRead: new TextEncoder().encode(svg).byteLength,
      truncated: false,
    });
  });
});
