import type { AppDispatch, RootState } from 'app/store';
import { api } from 'features/api/apiSlice';
import { historyActions } from './historySlice';
import { convertToIdPaths } from 'patches/convertToIdPaths';
import { resolvePath } from 'patches/resolvePath';
import type { CacheDiff, FieldEdit, ImmerPatch } from 'types/CacheDiff';

type PatchCollection = {
  patches: ImmerPatch[];
  inversePatches: ImmerPatch[];
  undo: () => void;
};

let _seq = 0;
const newDiffId = () => `d${(++_seq).toString(36)}-${Date.now().toString(36)}`;

/**
 * Drop-in replacement for api.util.updateQueryData that additionally:
 *   1. Snapshots the cache before the update
 *   2. Converts Immer array-index patches to stable id-based FieldEdits
 *   3. Pushes a CacheDiff onto history (buffered into the open transaction if any)
 *
 * To group multiple calls into one undoable unit, wrap with:
 *   dispatch(historyActions.beginTransaction());
 *   dispatch(trackableUpdateQueryData(...));
 *   dispatch(trackableUpdateQueryData(...));
 *   dispatch(historyActions.commitTransaction());
 */
export const trackableUpdateQueryData = (
  endpointName: string,
  arg: unknown,
  recipe: (draft: any) => void,
) =>
  (dispatch: AppDispatch, getState: () => RootState): PatchCollection => {
    const cacheBefore = (
      (api.endpoints as Record<string, any>)[endpointName]?.select(arg)(getState()).data ?? []
    ) as Array<{ id: string }>;

    const patchCollection = dispatch(
      (api.util.updateQueryData as any)(endpointName, arg, recipe),
    ) as PatchCollection;

    if (patchCollection?.patches?.length > 0) {
      const diff: CacheDiff = {
        id: newDiffId(),
        timestamp: Date.now(),
        endpointName,
        queryArg: arg,
        edits: convertToIdPaths(cacheBefore, patchCollection.patches),
        patches: patchCollection.patches,
        inversePatches: patchCollection.inversePatches,
      };
      dispatch(historyActions.push(diff));
    }

    return patchCollection;
  };

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

function applyEdits(
  draft: unknown[],
  edits: FieldEdit[],
  direction: 'undo' | 'redo',
): void {
  const list = direction === 'undo' ? [...edits].reverse() : edits;
  list.forEach(edit => {
    const value = direction === 'undo' ? edit.before : edit.after;
    if (edit.op === 'remove' && direction === 'undo') return; // re-insertion not yet implemented
    try {
      const { parent, key } = resolvePath(draft, edit.path);
      if (parent != null && key !== '' && key !== -1) {
        (parent as Record<string | number, unknown>)[key] = value;
      }
    } catch {
      // entity was removed from cache between edit and undo — skip
    }
  });
}

function applyTransaction(
  dispatch: AppDispatch,
  diffs: CacheDiff[],
  direction: 'undo' | 'redo',
): void {
  // Undo: reverse the diff order so the last mutation is reverted first
  const ordered = direction === 'undo' ? [...diffs].reverse() : diffs;
  ordered.forEach(diff => {
    dispatch(
      (api.util.updateQueryData as any)(
        diff.endpointName,
        diff.queryArg,
        (draft: unknown[]) => { applyEdits(draft, diff.edits, direction); },
      ),
    );
  });
}

export const undoAction = () =>
  (dispatch: AppDispatch, getState: () => RootState): void => {
    const { past } = getState().history;
    const tx = past[past.length - 1];
    if (!tx) return;
    // Bypass trackableUpdateQueryData so undo does NOT create a new history entry
    applyTransaction(dispatch, tx.diffs, 'undo');
    dispatch(historyActions.undo());
  };

export const redoAction = () =>
  (dispatch: AppDispatch, getState: () => RootState): void => {
    const { future } = getState().history;
    const tx = future[0];
    if (!tx) return;
    applyTransaction(dispatch, tx.diffs, 'redo');
    dispatch(historyActions.redo());
  };
