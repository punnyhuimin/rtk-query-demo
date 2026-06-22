import { resolvePath } from './resolvePath';

export function setByPath(root: unknown, path: string, value: unknown): void {
  const { parent, key } = resolvePath(root, path);
  (parent as Record<string | number, unknown>)[key] = value;
}
