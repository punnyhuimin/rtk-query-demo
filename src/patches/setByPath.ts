import type { EditableValue } from 'types/EditableValue';
import { resolvePath } from './resolvePath';

export function setByPath(root: unknown, path: string, value: EditableValue): void {
  const { parent, key } = resolvePath(root, path);
  (parent as any)[key] = value;
}
