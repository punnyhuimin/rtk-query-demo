import type { EditableValue } from 'types/EditableValue';
import { setByPath } from './setByPath';

export function applyPatch(root: unknown, path: string, value: EditableValue): void {
  setByPath(root, path, value);
}
