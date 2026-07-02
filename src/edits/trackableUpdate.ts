import type { AppDispatch, RootState } from 'app/store';
import { api } from 'features/api/apiSlice';
import { historyActions } from './historySlice';
import { convertToIdPaths } from 'patches/convertToIdPaths';
import { resolvePath } from 'patches/resolvePath';
import type { CacheDiff, FieldEdit, Patch } from 'types/CacheDiff';
import { extractOrderIdsFromTransaction } from './diffUtils';

type PatchCollection = {
  patches: Patch[];
  inversePatches: Patch[];
  undo: () => void;
};

let _seq = 0;
const newDiffId = () => `d${(++_seq).toString(36)}-${Date.now().toString(36)}`;

const selectCache = (endpointName: string, arg: unknown, state: RootState) =>
  ((api.endpoints as Record<string, any>)[endpointName]?.select(arg)(state).data ?? []) as Array<{ id: string }>;

/**
 * Drop-in replacement for api.util.updateQueryData that additionally:
 *   1. Snapshots cacheBefore and cacheAfter around the mutation
 *   2. Diffs the two snapshots into stable id-based FieldEdits
 *   3. Pushes a CacheDiff onto history (buffered into the open transaction if any)
 *
 * We snapshot before+after rather than relying on Immer's raw patches because
 * array.splice() emits shift patches (element replacements + a final remove),
 * not a clean "entity X deleted at index N". The before/after comparison gives
 * us the semantic intent — including the original index for position-correct undo.
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
    const cacheBefore = selectCache(endpointName, arg, getState());

    const patchCollection = dispatch(
      (api.util.updateQueryData as any)(endpointName, arg, recipe),
    ) as PatchCollection;

    const cacheAfter = selectCache(endpointName, arg, getState());

    const edits = cacheBefore !== cacheAfter
      ? convertToIdPaths(cacheBefore, cacheAfter)
      : [];

    // Always push inside an open transaction so every update intent is captured
    // in the atomic undo unit, even when this particular recipe was a no-op.
    // Outside a transaction only push when there are actual edits to record.
    if (edits.length > 0 || getState().history.inTransaction) {
      const diff: CacheDiff = {
        id: newDiffId(),
        timestamp: Date.now(),
        endpointName,
        queryArg: arg,
        edits,
        patches: patchCollection?.patches ?? [],
        inversePatches: patchCollection?.inversePatches ?? [],
      };
      dispatch(historyActions.push(diff));
    }

    return patchCollection;
  };

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

/** True for paths like "[id=abc]" or "[0]" (no field segment after the id). */
const isEntityLevel = (path: string) => !path.includes('/');

function applyEdit(
  draft: unknown[],
  edit: FieldEdit,
  direction: 'undo' | 'redo',
): void {
  const isUndo = direction === 'undo';

  if (isEntityLevel(edit.path)) {
    const arr = draft as Array<Record<string, unknown>>;
    // The live entity is in `after` for adds, `before` for removes.
    const entity = (edit.op === 'add' ? edit.after : edit.before) as Record<string, unknown> | undefined;
    // XOR: insert when (add AND redo) OR (remove AND undo); remove otherwise.
    const inserting = (edit.op === 'add') !== isUndo;

    if (inserting) {
      if (entity != null) arr.splice(edit.index ?? arr.length, 0, entity);
    } else {
      const id = (entity as { id?: string } | undefined)?.id;
      if (id) {
        const idx = arr.findIndex(e => e.id === id);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }
    return;
  }

  // Field-level: apply the target snapshot value.
  // before=undefined → field didn't exist before → undo deletes it.
  // after=undefined → field was deleted → redo deletes it.
  const { parent, key } = resolvePath(draft, edit.path);
  if (parent == null || key === '' || key === -1) return;

  const rec = parent as Record<string | number, unknown>;
  const target = isUndo ? edit.before : edit.after;

  // When the parent is an array and the key is a numeric index, use splice so
  // elements are properly inserted/removed rather than overwriting slots.
  // This handles nested arrays like item.warehouses whose changes are described
  // by index-based RFC 6902 paths (e.g. "[id=x]/warehouses/2").
  const numKey = Number(key);
  if (Array.isArray(rec) && !isNaN(numKey)) {
    if (target === undefined) {
      rec.splice(numKey, 1);                   // remove element
    } else if (edit.op !== 'replace') {
      rec.splice(numKey, 0, target);            // insert element (add / inverted remove)
    } else {
      rec[numKey] = target;                     // overwrite in-place
    }
    return;
  }

  if (target === undefined) {
    delete rec[key];
  } else {
    rec[key] = target;
  }
}

function applyEdits(
  draft: unknown[],
  edits: FieldEdit[],
  direction: 'undo' | 'redo',
): void {
  if (direction === 'undo') {
    // Entity-level removes are re-inserted via splice(index, 0, entity).
    // Splicing in REVERSE index order would push earlier items out of place,
    // so we separate them out and process them in ASCENDING index order after
    // all other (non-removal) edits have been reverted.
    const entityRemoves = edits
      .filter(e => e.op === 'remove' && isEntityLevel(e.path))
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));

    const others = edits.filter(e => !(e.op === 'remove' && isEntityLevel(e.path)));

    [...others].reverse().forEach(edit => {
      try { applyEdit(draft, edit, 'undo'); } catch { /* entity gone — skip */ }
    });

    entityRemoves.forEach(edit => {
      try { applyEdit(draft, edit, 'undo'); } catch { /* entity gone — skip */ }
    });
  } else {
    edits.forEach(edit => {
      try { applyEdit(draft, edit, 'redo'); } catch { /* entity gone — skip */ }
    });
  }
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

export const undoAction = (
  isOrderLocked?: (orderId: string, state: RootState) => boolean,
) =>
  (dispatch: AppDispatch, getState: () => RootState): void => {
    const state = getState();
    const tx = state.history.past[state.history.past.length - 1];
    if (!tx) return;

    if (isOrderLocked) {
      const orderIds = extractOrderIdsFromTransaction(tx);
      if (orderIds.some(id => isOrderLocked(id, state))) return;
    }

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
