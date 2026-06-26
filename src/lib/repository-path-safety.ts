import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

const PATH_OUTSIDE_REPOSITORY = 'path-outside-repository';

export function resolveRepoPath(repoPath: string, relativePath: string): string {
  const root = path.resolve(repoPath);
  const target = path.resolve(root, relativePath);
  if (!isPathInside(root, target)) {
    throw new Error(PATH_OUTSIDE_REPOSITORY);
  }
  return target;
}

export async function resolveSafeExistingRepoPath(repoPath: string, relativePath: string): Promise<string> {
  const target = resolveRepoPath(repoPath, relativePath);
  const rootRealPath = await realpath(path.resolve(repoPath));
  const targetRealPath = await realpath(target);
  if (!isPathInside(rootRealPath, targetRealPath)) {
    throw new Error(PATH_OUTSIDE_REPOSITORY);
  }
  return target;
}

export async function resolveSafeWritableRepoPath(repoPath: string, relativePath: string): Promise<string> {
  const root = path.resolve(repoPath);
  const target = resolveRepoPath(root, relativePath);
  const rootRealPath = await realpath(root);
  const existingAncestor = await findExistingAncestor(path.dirname(target), root);
  const ancestorRealPath = await realpath(existingAncestor);
  if (!isPathInside(rootRealPath, ancestorRealPath)) {
    throw new Error(PATH_OUTSIDE_REPOSITORY);
  }

  const targetLstat = await lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (targetLstat?.isSymbolicLink()) {
    throw new Error(PATH_OUTSIDE_REPOSITORY);
  }

  try {
    const targetRealPath = await realpath(target);
    if (!isPathInside(rootRealPath, targetRealPath)) {
      throw new Error(PATH_OUTSIDE_REPOSITORY);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return target;
}

function isPathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function findExistingAncestor(startPath: string, root: string): Promise<string> {
  let current = path.resolve(startPath);
  while (isPathInside(root, current)) {
    try {
      await lstat(current);
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(PATH_OUTSIDE_REPOSITORY);
}
