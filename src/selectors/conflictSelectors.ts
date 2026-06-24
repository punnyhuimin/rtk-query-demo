import type { RootState } from 'app/store';
import type { Conflict } from 'types/Conflict';
import { getByPath } from 'patches/getByPath';

export const selectEntityConflicts = (
  state: RootState,
  key: string,
  serverEntity: unknown
): Conflict[] => {
  const edits = state.edits.fields[key] ?? {};
  return Object.values(edits).flatMap(edit => {
    const currentServerValue = getByPath(serverEntity, edit.path);
    if (currentServerValue !== edit.originalValue) {
      return [{
        entityKey: key,
        path: edit.path,
        originalValue: edit.originalValue,
        editedValue: edit.editedValue,
        currentServerValue,
      }] as Conflict[];
    }
    return [];
  });
};
