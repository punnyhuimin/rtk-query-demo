import { useCallback, useSyncExternalStore } from 'react';
import { useDispatch, useStore } from 'react-redux';
import type { AppDispatch, RootState } from 'app/store';
import { history } from './history';
import { undoAction, redoAction } from './trackableUpdate';

export function useHistory(
  isOrderLocked?: (orderId: string, state: RootState) => boolean,
) {
  const dispatch = useDispatch<AppDispatch>();
  const storeRef = useStore<RootState>();

  const { canUndo, canRedo, past } = useSyncExternalStore(
    history.subscribe.bind(history),
    history.getSnapshot.bind(history),
  );

  const undo = useCallback(
    () => { undoAction(dispatch, storeRef.getState.bind(storeRef), isOrderLocked); },
    [dispatch, storeRef, isOrderLocked],
  );
  const redo = useCallback(() => { redoAction(dispatch); }, [dispatch]);
  const clear = useCallback(() => { history.clear(); }, []);
  const purgeByIds = useCallback(
    (...ids: string[]) => { history.purgeByIds(ids); },
    [],
  );
  const setMaxSize = useCallback(
    (n: number) => { history.setMaxSize(n); },
    [],
  );

  return { undo, redo, clear, purgeByIds, setMaxSize, canUndo, canRedo, pastTransactions: past };
}
