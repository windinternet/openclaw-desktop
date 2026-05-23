import type { GatewayUser } from './types';
import { createGatewayClient } from './gateway';

function parseUserMd(markdown: string): GatewayUser | null {
  const getLine = (key: string): string | undefined => {
    const re = new RegExp(`-\\s*\\*\\*${key}\\*\\*[:：]\\s*(.+)`, 'im');
    return markdown.match(re)?.[1]?.trim();
  };
  const getMulti = (heading: string): string | undefined => {
    const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'im');
    const match = markdown.match(re);
    return match?.[1]?.trim();
  };

  const name = getLine('Name');
  if (!name) return null;

  return {
    name,
    whatToCall: getLine('What to call them') ?? name,
    timezone: getLine('Timezone'),
    os: getLine('OS'),
    notes: getMulti('Notes'),
  };
}

const FILE_READ_METHODS = [
  'workspace.readFile',
  'agent.readFile',
  'file.read',
  'workspace.file.read',
  'agent.file.read',
];

export async function fetchGatewayUser(
  gatewayUrl: string,
  token: string,
): Promise<GatewayUser | null> {
  const client = createGatewayClient({ url: gatewayUrl, token });
  try {
    const hello = await client.connect();
    const methods = hello.features?.methods ?? [];

    const method = FILE_READ_METHODS.find((m) => methods.includes(m));
    if (!method) {
      console.warn('[fetchGatewayUser] no file-read method in', methods.slice(0, 10));
      return null;
    }

    const result = await client.request<{ content?: string; text?: string; data?: string }>(
      method,
      { path: 'USER.md' },
    );
    const raw = result?.content ?? result?.text ?? result?.data ?? '';
    if (!raw) return null;

    return parseUserMd(raw);
  } catch (err) {
    console.error('[fetchGatewayUser]', err);
    return null;
  } finally {
    client.disconnect();
  }
}
