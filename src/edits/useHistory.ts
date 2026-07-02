import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from 'app/hooks';
import type { RootState } from 'app/store';
import {
  selectCanUndo,
  selectCanRedo,
  selectPastTransactions,
  historyActions,
} from './historySlice';
import { undoAction, redoAction } from './trackableUpdate';

export function useHistory(
  isOrderLocked?: (orderId: string, state: RootState) => boolean,
) {
  const dispatch = useAppDispatch();
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const pastTransactions = useAppSelector(selectPastTransactions);

  const undo = useCallback(
    () => { dispatch(undoAction(isOrderLocked)); },
    [dispatch, isOrderLocked],
  );
  const redo = useCallback(() => { dispatch(redoAction()); }, [dispatch]);
  const clear = useCallback(() => { dispatch(historyActions.clear()); }, [dispatch]);
  const purgeByIds = useCallback(
    (...ids: string[]) => { dispatch(historyActions.purgeByIds(ids)); },
    [dispatch],
  );
  const setMaxSize = useCallback(
    (n: number) => { dispatch(historyActions.setMaxSize(n)); },
    [dispatch],
  );

  return { undo, redo, clear, purgeByIds, setMaxSize, canUndo, canRedo, pastTransactions };
}
