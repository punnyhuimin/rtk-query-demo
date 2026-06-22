import type { UserEdit } from 'edits/types';
import { applyPatch } from './applyPatch';

export function applyPatches(root: unknown, edits: Record<string, UserEdit>): void {
  Object.values(edits).forEach(edit => applyPatch(root, edit.path, edit.editedValue));
}
