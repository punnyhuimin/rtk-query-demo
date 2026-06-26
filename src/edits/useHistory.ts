import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from 'app/hooks';
import {
  selectCanUndo,
  selectCanRedo,
  selectPastTransactions,
  historyActions,
} from './historySlice';
import { undoAction, redoAction } from './trackableUpdate';

export function useHistory() {
  const dispatch = useAppDispatch();
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const pastTransactions = useAppSelector(selectPastTransactions);

  const undo = useCallback(() => { dispatch(undoAction()); }, [dispatch]);
  const redo = useCallback(() => { dispatch(redoAction()); }, [dispatch]);
  const clear = useCallback(() => { dispatch(historyActions.clear()); }, [dispatch]);
  const purgeByOrderId = useCallback(
    (orderId: string) => { dispatch(historyActions.purgeByOrderIds([orderId])); },
    [dispatch],
  );

  return { undo, redo, clear, purgeByOrderId, canUndo, canRedo, pastTransactions };
}
