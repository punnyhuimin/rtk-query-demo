import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { useHistory } from './useHistory';
import { history } from './history';
import type { CacheDiff, Transaction } from 'types/CacheDiff';

// Mock trackableUpdate so undo/redo only exercise history state, not the api cache.
jest.mock('./trackableUpdate', () => {
  const { history: h } = require('./history') as typeof import('./history');
  return {
    undoAction: (_d: unknown, _g: unknown, isOrderLocked?: unknown) => { void isOrderLocked; h.undo(); },
    redoAction: (_d: unknown) => { h.redo(); },
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

const store = configureStore({ reducer: { _: (s = null) => s } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(Provider, { store } as any, children);

beforeEach(() => history.reset());

describe('useHistory', () => {
  it('canUndo reflects whether past has entries', () => {
    const { result } = renderHook(() => useHistory(), { wrapper });
    expect(result.current.canUndo).toBe(false);
    act(() => { history.reset({ past: [makeTx()] }); });
    expect(result.current.canUndo).toBe(true);
  });

  it('canRedo reflects whether future has entries', () => {
    const { result } = renderHook(() => useHistory(), { wrapper });
    expect(result.current.canRedo).toBe(false);
    act(() => { history.reset({ future: [makeTx()] }); });
    expect(result.current.canRedo).toBe(true);
  });

  it('pastTransactions mirrors history state', () => {
    const tx = makeTx();
    history.reset({ past: [tx] });
    const { result } = renderHook(() => useHistory(), { wrapper });
    expect(result.current.pastTransactions).toEqual([tx]);
  });

  it('undo() moves a transaction from past to future', () => {
    history.reset({ past: [makeTx()] });
    const { result } = renderHook(() => useHistory(), { wrapper });
    act(() => { result.current.undo(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo() moves a transaction from future to past', () => {
    history.reset({ future: [makeTx()] });
    const { result } = renderHook(() => useHistory(), { wrapper });
    act(() => { result.current.redo(); });
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('clear() empties past and future', () => {
    history.reset({ past: [makeTx()], future: [makeTx('tx-2')] });
    const { result } = renderHook(() => useHistory(), { wrapper });
    act(() => { result.current.clear(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.pastTransactions).toEqual([]);
  });

  it('purgeByIds() removes matching transactions from past', () => {
    const matchTx: Transaction = {
      id: 'tx-match',
      timestamp: 1000,
      diffs: [{ ...makeDiff(), queryArg: 'order-1' }],
    };
    history.reset({ past: [matchTx] });
    const { result } = renderHook(() => useHistory(), { wrapper });
    act(() => { result.current.purgeByIds('order-1'); });
    expect(result.current.canUndo).toBe(false);
  });

  it('setMaxSize() trims past when it exceeds the new limit', () => {
    history.reset({ past: [makeTx('tx-1'), makeTx('tx-2'), makeTx('tx-3')] });
    const { result } = renderHook(() => useHistory(), { wrapper });
    act(() => { result.current.setMaxSize(2); });
    expect(result.current.pastTransactions).toHaveLength(2);
  });
});
