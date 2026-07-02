import { configureStore } from '@reduxjs/toolkit';
import { api } from 'features/api/apiSlice';
import historyReducer, { type HistoryState } from './historySlice';
import { trackableUpdateQueryData, undoAction, redoAction } from './trackableUpdate';
import type { CacheDiff, Transaction } from 'types/CacheDiff';

jest.mock('features/api/apiSlice', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual('@reduxjs/toolkit/query/react');

  const api = createApi({
    reducerPath: 'api',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/v1/' }),
    endpoints: () => ({}),
  });

  return {
    api: {
      ...api,
      util: { ...api.util, updateQueryData: jest.fn() },
      endpoints: { getOrders: { select: jest.fn() } },
    },
  };
});

const mockUpdateQueryData = api.util.updateQueryData as jest.Mock;
const mockEndpointSelect = (api.endpoints as Record<string, any>).getOrders.select as jest.Mock;

const stubPatchCollection = { patches: [], inversePatches: [], undo: jest.fn() };

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

const makeDiff = (overrides: Partial<CacheDiff> = {}): CacheDiff => ({
  id: 'diff-1',
  timestamp: 1000,
  endpointName: 'getOrders',
  queryArg: 'order-1',
  edits: [],
  patches: [],
  inversePatches: [],
  ...overrides,
});

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  timestamp: 1000,
  diffs: [makeDiff()],
  ...overrides,
});

beforeEach(() => {
  mockUpdateQueryData.mockImplementation(
    () => (_dispatch: unknown, _getState: unknown) => stubPatchCollection,
  );
});

// ---------------------------------------------------------------------------
// trackableUpdateQueryData
// ---------------------------------------------------------------------------

describe('trackableUpdateQueryData', () => {
  it('pushes a CacheDiff with edits to history when the cache changes', () => {
    const cacheBefore = [{ id: '1', name: 'Before' }];
    const cacheAfter  = [{ id: '1', name: 'After'  }];
    const selector = jest.fn()
      .mockReturnValueOnce({ data: cacheBefore })
      .mockReturnValueOnce({ data: cacheAfter });
    mockEndpointSelect.mockReturnValue(selector);

    const store = makeStore();
    (store.dispatch as any)(trackableUpdateQueryData('getOrders', 'order-1', () => {}));

    const { past } = store.getState().history;
    expect(past).toHaveLength(1);
    expect(past[0].diffs[0].endpointName).toBe('getOrders');
    expect(past[0].diffs[0].queryArg).toBe('order-1');
    expect(past[0].diffs[0].edits).toHaveLength(1);
    expect(past[0].diffs[0].edits[0].path).toBe('[id=1]/name');
  });

  it('does NOT push to history when the cache is unchanged outside a transaction', () => {
    const sameCache = [{ id: '1', name: 'Same' }];
    const selector = jest.fn().mockReturnValue({ data: sameCache });
    mockEndpointSelect.mockReturnValue(selector);

    const store = makeStore();
    (store.dispatch as any)(trackableUpdateQueryData('getOrders', 'order-1', () => {}));

    expect(store.getState().history.past).toHaveLength(0);
  });

  it('buffers into pending inside a transaction even when the cache is unchanged', () => {
    const sameCache = [{ id: '1', name: 'Same' }];
    const selector = jest.fn().mockReturnValue({ data: sameCache });
    mockEndpointSelect.mockReturnValue(selector);

    const store = makeStore({ inTransaction: true });
    (store.dispatch as any)(trackableUpdateQueryData('getOrders', 'order-1', () => {}));

    expect(store.getState().history.pending).toHaveLength(1);
    expect(store.getState().history.pending[0].edits).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// undoAction
// ---------------------------------------------------------------------------

describe('undoAction', () => {
  it('is a no-op when past is empty', () => {
    const store = makeStore();
    (store.dispatch as any)(undoAction());
    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('calls api.util.updateQueryData for each diff and moves the transaction to future', () => {
    const tx = makeTx({ diffs: [makeDiff(), makeDiff({ id: 'diff-2', queryArg: 'order-2' })] });
    const store = makeStore({ past: [tx] });

    (store.dispatch as any)(undoAction());

    // diffs are applied in reverse for undo, so both endpoints are hit
    expect(mockUpdateQueryData).toHaveBeenCalledTimes(2);
    expect(mockUpdateQueryData).toHaveBeenCalledWith('getOrders', 'order-1', expect.any(Function));
    expect(mockUpdateQueryData).toHaveBeenCalledWith('getOrders', 'order-2', expect.any(Function));

    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.future[0].id).toBe('tx-1');
  });

  it('undo recipe reverts a field change to its before value', () => {
    const diff = makeDiff({
      edits: [{ path: '[id=1]/name', op: 'replace', before: 'Original', after: 'Changed' }],
    });
    const store = makeStore({ past: [makeTx({ diffs: [diff] })] });

    let capturedRecipe: ((draft: unknown[]) => void) | null = null;
    mockUpdateQueryData.mockImplementation(
      (_ep: string, _arg: unknown, recipe: (draft: unknown[]) => void) => {
        capturedRecipe = recipe;
        return () => stubPatchCollection;
      },
    );

    (store.dispatch as any)(undoAction());

    const draft = [{ id: '1', name: 'Changed' }];
    capturedRecipe!(draft);
    expect((draft[0] as any).name).toBe('Original');
  });
});

describe('undoAction with isOrderLocked', () => {
  it('skips the transaction when the predicate returns true for a string queryArg', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] });
    const store = makeStore({ past: [tx] });

    (store.dispatch as any)(undoAction(id => id === 'order-1'));

    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.future).toHaveLength(0);
  });

  it('skips when the predicate returns true for any order in the transaction', () => {
    const tx = makeTx({
      diffs: [
        makeDiff({ queryArg: 'order-1' }),
        makeDiff({ id: 'diff-2', queryArg: 'order-2' }),
      ],
    });
    const store = makeStore({ past: [tx] });

    (store.dispatch as any)(undoAction(id => id === 'order-2'));

    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(1);
  });

  it('skips when the predicate returns true for a queryArg.orderId (searchItems endpoint)', () => {
    const tx = makeTx({ diffs: [makeDiff({ endpointName: 'searchItems', queryArg: { orderId: 'order-1' } })] });
    const store = makeStore({ past: [tx] });

    (store.dispatch as any)(undoAction(id => id === 'order-1'));

    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(1);
  });

  it('undoes normally when the predicate returns false for all touched orders', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] });
    const store = makeStore({ past: [tx] });

    (store.dispatch as any)(undoAction(() => false));

    expect(mockUpdateQueryData).toHaveBeenCalledTimes(1);
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.future).toHaveLength(1);
  });

  it('passes the current state to the predicate', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] });
    const store = makeStore({ past: [tx] });
    const isOrderLocked = jest.fn().mockReturnValue(false);

    (store.dispatch as any)(undoAction(isOrderLocked));

    expect(isOrderLocked).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ history: expect.any(Object) }),
    );
  });

  it('calls the predicate once per unique ID extracted from the transaction', () => {
    const tx = makeTx({
      diffs: [
        makeDiff({ queryArg: 'ws-1' }),
        makeDiff({ id: 'diff-2', endpointName: 'searchItems', queryArg: { orderId: 'order-2' } }),
      ],
    });
    const store = makeStore({ past: [tx] });
    const isOrderLocked = jest.fn().mockReturnValue(false);

    (store.dispatch as any)(undoAction(isOrderLocked));

    expect(isOrderLocked).toHaveBeenCalledWith('ws-1', expect.any(Object));
    expect(isOrderLocked).toHaveBeenCalledWith('order-2', expect.any(Object));
    expect(mockUpdateQueryData).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// redoAction
// ---------------------------------------------------------------------------

describe('redoAction', () => {
  it('is a no-op when future is empty', () => {
    const store = makeStore();
    (store.dispatch as any)(redoAction());
    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(store.getState().history.future).toHaveLength(0);
  });

  it('calls api.util.updateQueryData for each diff and moves the transaction to past', () => {
    const tx = makeTx();
    const store = makeStore({ future: [tx] });

    (store.dispatch as any)(redoAction());

    expect(mockUpdateQueryData).toHaveBeenCalledWith('getOrders', 'order-1', expect.any(Function));
    expect(store.getState().history.future).toHaveLength(0);
    expect(store.getState().history.past[0].id).toBe('tx-1');
  });

  it('redo recipe re-applies a field change to its after value', () => {
    const diff = makeDiff({
      edits: [{ path: '[id=1]/name', op: 'replace', before: 'Original', after: 'Changed' }],
    });
    const store = makeStore({ future: [makeTx({ diffs: [diff] })] });

    let capturedRecipe: ((draft: unknown[]) => void) | null = null;
    mockUpdateQueryData.mockImplementation(
      (_ep: string, _arg: unknown, recipe: (draft: unknown[]) => void) => {
        capturedRecipe = recipe;
        return () => stubPatchCollection;
      },
    );

    (store.dispatch as any)(redoAction());

    const draft = [{ id: '1', name: 'Original' }];
    capturedRecipe!(draft);
    expect((draft[0] as any).name).toBe('Changed');
  });
});
