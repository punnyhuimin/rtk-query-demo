import { useHistory } from './useHistory';
import { useUndoRedoShortcut } from './useUndoRedoShortcut';
import { isEntityLocked } from 'features/workspace/isEntityLocked';

/**
 * Binds the global undo/redo keyboard shortcuts to the transaction history,
 * blocking undo for locked workspaces/orders.
 * Call once at the top of the component tree (e.g. in App).
 */
export function useGlobalUndoRedo(): void {
  const { undo, redo } = useHistory(isEntityLocked);
  useUndoRedoShortcut(undo, redo);
}
