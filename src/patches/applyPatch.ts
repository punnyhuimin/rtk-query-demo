import { setByPath } from './setByPath';

export function applyPatch(root: unknown, path: string, value: unknown): void {
  setByPath(root, path, value);
}
