import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveRepoPath,
  resolveSafeExistingRepoPath,
  resolveSafeWritableRepoPath,
} from '../lib/repository-path-safety';

let tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'openclaw-repo-path-'));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots = [];
});

describe('repository path safety', () => {
  it('keeps plain relative paths inside the repository boundary', () => {
    const target = resolveRepoPath('/repo', 'work/now.md');

    expect(target).toBe(path.resolve('/repo', 'work/now.md'));
    expect(() => resolveRepoPath('/repo', '../secret.md')).toThrow('path-outside-repository');
    expect(() => resolveRepoPath('/repo', '/tmp/secret.md')).toThrow('path-outside-repository');
  });

  it('allows existing files whose real path stays inside the repository', async () => {
    const repo = await createTempRoot();
    await mkdir(path.join(repo, 'work'));
    await writeFile(path.join(repo, 'work', 'now.md'), '# Now');

    await expect(resolveSafeExistingRepoPath(repo, 'work/now.md')).resolves.toBe(path.join(repo, 'work', 'now.md'));
  });

  it('rejects existing symlinks that resolve outside the repository', async () => {
    const root = await createTempRoot();
    const repo = path.join(root, 'repo');
    const outside = path.join(root, 'outside');
    await mkdir(repo);
    await mkdir(outside);
    await writeFile(path.join(outside, 'secret.md'), '# Secret');
    await symlink(path.join(outside, 'secret.md'), path.join(repo, 'now.md'));

    await expect(resolveSafeExistingRepoPath(repo, 'now.md')).rejects.toThrow('path-outside-repository');
  });

  it('rejects existing paths below parent symlinks that resolve outside the repository', async () => {
    const root = await createTempRoot();
    const repo = path.join(root, 'repo');
    const outside = path.join(root, 'outside');
    await mkdir(repo);
    await mkdir(outside);
    await writeFile(path.join(outside, 'secret.md'), '# Secret');
    await symlink(outside, path.join(repo, 'work'));

    await expect(resolveSafeExistingRepoPath(repo, 'work/secret.md')).rejects.toThrow('path-outside-repository');
  });

  it('rejects writes through symlinks that resolve outside the repository', async () => {
    const root = await createTempRoot();
    const repo = path.join(root, 'repo');
    const outside = path.join(root, 'outside');
    await mkdir(repo);
    await mkdir(outside);
    await writeFile(path.join(outside, 'secret.md'), '# Secret');
    await symlink(path.join(outside, 'secret.md'), path.join(repo, 'now.md'));

    await expect(resolveSafeWritableRepoPath(repo, 'now.md')).rejects.toThrow('path-outside-repository');
    await expect(readFile(path.join(outside, 'secret.md'), 'utf8')).resolves.toBe('# Secret');
  });

  it('rejects writes through dangling symlinks that would create files outside the repository', async () => {
    const root = await createTempRoot();
    const repo = path.join(root, 'repo');
    const outside = path.join(root, 'outside');
    const missingOutsideFile = path.join(outside, 'created.md');
    await mkdir(repo);
    await mkdir(outside);
    await symlink(missingOutsideFile, path.join(repo, 'now.md'));

    await expect(resolveSafeWritableRepoPath(repo, 'now.md')).rejects.toThrow('path-outside-repository');
    await expect(readFile(missingOutsideFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects writes below parent symlinks that resolve outside the repository', async () => {
    const root = await createTempRoot();
    const repo = path.join(root, 'repo');
    const outside = path.join(root, 'outside');
    await mkdir(repo);
    await mkdir(outside);
    await symlink(outside, path.join(repo, 'work'));

    await expect(resolveSafeWritableRepoPath(repo, 'work/new.md')).rejects.toThrow('path-outside-repository');
  });

  it('allows writes to new files under repository-owned directories', async () => {
    const repo = await createTempRoot();

    await expect(resolveSafeWritableRepoPath(repo, 'work/new.md')).resolves.toBe(path.join(repo, 'work', 'new.md'));
  });
});
