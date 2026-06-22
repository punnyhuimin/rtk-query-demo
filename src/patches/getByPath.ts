import { resolvePath } from './resolvePath';

export function getByPath(root: unknown, path: string): unknown {
  const { parent, key } = resolvePath(root, path);
  return parent[key];
}
