import type { EditableValue } from 'types/EditableValue';
import { resolvePath } from './resolvePath';

export function getByPath(root: unknown, path: string): EditableValue {
  const { parent, key } = resolvePath(root, path);
  return (parent as any)[key] as EditableValue;
}
