import { describe, expect, it } from 'vitest';
import { buildArtifactBridgeFetchResponse, resolveArtifactBridgeFetchRequest } from '../lib/artifact-bridge-fetch';

describe('artifact bridge fetch request normalization', () => {
  it('accepts only approved HTTP(S) fetch inputs for artifact HTML', () => {
    const request = resolveArtifactBridgeFetchRequest({
      url: 'https://api.example.com/data',
      init: {
        method: 'post',
        headers: {
          Accept: 'application/json',
          'X-Trace': 123,
        },
        body: JSON.stringify({ ok: true }),
      },
    });

    expect(request).toEqual({
      url: 'https://api.example.com/data',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Trace': '123',
      },
      body: '{"ok":true}',
      maxBytes: 524288,
    });

    expect(() => resolveArtifactBridgeFetchRequest({ url: 'file:///etc/passwd' })).toThrow(
      'Artifact Bridge fetch only allows http(s) URLs',
    );
    expect(() => resolveArtifactBridgeFetchRequest({ url: 'https://api.example.com', init: { method: 'CONNECT' } }))
      .toThrow('Artifact Bridge fetch method is not allowed');
  });

  it('serializes fetch responses with size-limited body text', async () => {
    const response = new Response('abcdef', {
      status: 201,
      statusText: 'Created',
      headers: {
        'content-type': 'text/plain',
      },
    });

    await expect(buildArtifactBridgeFetchResponse(response, 4)).resolves.toEqual({
      ok: true,
      status: 201,
      statusText: 'Created',
      url: '',
      headers: {
        'content-type': 'text/plain',
      },
      body: 'abcd',
      bytes: 4,
      truncated: true,
    });
  });
});
