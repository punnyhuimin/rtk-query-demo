import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { useHistory } from './useHistory';
import historyReducer, { type HistoryState } from './historySlice';
import type { CacheDiff, Transaction } from 'types/CacheDiff';

// Prevent trackableUpdate from trying to touch the api cache during undo/redo.
// The mock thunks replicate only the history-slice side-effect.
jest.mock('./trackableUpdate', () => {
  const { historyActions: actions } = require('./historySlice') as typeof import('./historySlice');
  return {
    undoAction: () => (dispatch: (a: unknown) => void) => dispatch(actions.undo()),
    redoAction: () => (dispatch: (a: unknown) => void) => dispatch(actions.redo()),
  };
});

const makeDiff = (id = 'diff-1'): CacheDiff => ({
  id,
  timestamp: 1000,
  endpointName: 'getOrders',
  queryArg: 'order-1',
  edits: [],
  patches: [],
  inversePatches: [],
});

const makeTx = (id = 'tx-1'): Transaction => ({
  id,
  timestamp: 1000,
  diffs: [makeDiff()],
});

const BASE: HistoryState = {
  past: [],
  future: [],
  pending: [],
  inTransaction: false,
  maxSize: Infinity,
};

const makeStore = (history: Partial<HistoryState> = {}) =>
  configureStore({
    reducer: { history: historyReducer },
    preloadedState: { history: { ...BASE, ...history } },
  });

const makeWrapper =
  (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(Provider, { store } as any, children);

describe('useHistory', () => {
  it('canUndo reflects whether past has entries', () => {
    const { result: empty } = renderHook(() => useHistory(), {
      wrapper: makeWrapper(makeStore()),
    });
    expect(empty.current.canUndo).toBe(false);

    const { result: withPast } = renderHook(() => useHistory(), {
      wrapper: makeWrapper(makeStore({ past: [makeTx()] })),
    });
    expect(withPast.current.canUndo).toBe(true);
  });

  it('canRedo reflects whether future has entries', () => {
    const { result: empty } = renderHook(() => useHistory(), {
      wrapper: makeWrapper(makeStore()),
    });
    expect(empty.current.canRedo).toBe(false);

    const { result: withFuture } = renderHook(() => useHistory(), {
      wrapper: makeWrapper(makeStore({ future: [makeTx()] })),
    });
    expect(withFuture.current.canRedo).toBe(true);
  });

  it('pastTransactions mirrors store state', () => {
    const tx = makeTx();
    const { result } = renderHook(() => useHistory(), {
      wrapper: makeWrapper(makeStore({ past: [tx] })),
    });
    expect(result.current.pastTransactions).toEqual([tx]);
  });

  it('undo() moves a transaction from past to future', () => {
    const store = makeStore({ past: [makeTx()] });
    const { result } = renderHook(() => useHistory(), { wrapper: makeWrapper(store) });
    act(() => { result.current.undo(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo() moves a transaction from future to past', () => {
    const store = makeStore({ future: [makeTx()] });
    const { result } = renderHook(() => useHistory(), { wrapper: makeWrapper(store) });
    act(() => { result.current.redo(); });
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('clear() empties past and future', () => {
    const store = makeStore({ past: [makeTx()], future: [makeTx('tx-2')] });
    const { result } = renderHook(() => useHistory(), { wrapper: makeWrapper(store) });
    act(() => { result.current.clear(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.pastTransactions).toEqual([]);
  });

  it('purgeByOrderId() removes matching transactions from past', () => {
    const matchTx: Transaction = {
      id: 'tx-match',
      timestamp: 1000,
      diffs: [makeDiff()],
    };
    matchTx.diffs[0] = { ...matchTx.diffs[0], queryArg: 'order-1' };
    const store = makeStore({ past: [matchTx] });
    const { result } = renderHook(() => useHistory(), { wrapper: makeWrapper(store) });
    act(() => { result.current.purgeByOrderId('order-1'); });
    expect(result.current.canUndo).toBe(false);
  });

  it('setMaxSize() trims past when it exceeds the new limit', () => {
    const store = makeStore({
      past: [makeTx('tx-1'), makeTx('tx-2'), makeTx('tx-3')],
    });
    const { result } = renderHook(() => useHistory(), { wrapper: makeWrapper(store) });
    act(() => { result.current.setMaxSize(2); });
    expect(result.current.pastTransactions).toHaveLength(2);
  });
});
