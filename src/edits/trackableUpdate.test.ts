import { configureStore } from '@reduxjs/toolkit';
import { api } from 'features/api/apiSlice';
import { history } from './history';
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

// Minimal store — only needed for dispatch; history is managed by the singleton.
const makeStore = () => configureStore({ reducer: { _: (s = null) => s } });

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
  history.reset();
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
    history.beginTransaction();
    (store.dispatch as any)(trackableUpdateQueryData('getOrders', 'order-1', () => {}));
    history.commitTransaction();

    expect(history.past).toHaveLength(1);
    expect(history.past[0].diffs[0].endpointName).toBe('getOrders');
    expect(history.past[0].diffs[0].queryArg).toBe('order-1');
    expect(history.past[0].diffs[0].edits).toHaveLength(1);
    expect(history.past[0].diffs[0].edits[0].path).toBe('[id=1]/name');
  });

  it('does NOT push to history when the cache is unchanged outside a transaction', () => {
    const sameCache = [{ id: '1', name: 'Same' }];
    const selector = jest.fn().mockReturnValue({ data: sameCache });
    mockEndpointSelect.mockReturnValue(selector);

    const store = makeStore();
    (store.dispatch as any)(trackableUpdateQueryData('getOrders', 'order-1', () => {}));

    expect(history.past).toHaveLength(0);
  });

  it('does NOT buffer into pending inside a transaction when the cache is unchanged', () => {
    const sameCache = [{ id: '1', name: 'Same' }];
    const selector = jest.fn().mockReturnValue({ data: sameCache });
    mockEndpointSelect.mockReturnValue(selector);

    history.reset({ inTransaction: true });
    const store = makeStore();
    (store.dispatch as any)(trackableUpdateQueryData('getOrders', 'order-1', () => {}));

    expect(history.pending).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// undoAction
// ---------------------------------------------------------------------------

describe('undoAction', () => {
  it('is a no-op when past is empty', () => {
    const store = makeStore();
    undoAction(store.dispatch as any, store.getState as any);
    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(history.past).toHaveLength(0);
  });

  it('calls api.util.updateQueryData for each diff and moves the transaction to future', () => {
    const tx = makeTx({ diffs: [makeDiff(), makeDiff({ id: 'diff-2', queryArg: 'order-2' })] });
    history.reset({ past: [tx] });
    const store = makeStore();

    undoAction(store.dispatch as any, store.getState as any);

    expect(mockUpdateQueryData).toHaveBeenCalledTimes(2);
    expect(mockUpdateQueryData).toHaveBeenCalledWith('getOrders', 'order-1', expect.any(Function));
    expect(mockUpdateQueryData).toHaveBeenCalledWith('getOrders', 'order-2', expect.any(Function));

    expect(history.past).toHaveLength(0);
    expect(history.future[0].id).toBe('tx-1');
  });

  it('undo recipe reverts a field change to its before value', () => {
    const diff = makeDiff({
      edits: [{ path: '[id=1]/name', op: 'replace', before: 'Original', after: 'Changed' }],
    });
    history.reset({ past: [makeTx({ diffs: [diff] })] });
    const store = makeStore();

    let capturedRecipe: ((draft: unknown[]) => void) | null = null;
    mockUpdateQueryData.mockImplementation(
      (_ep: string, _arg: unknown, recipe: (draft: unknown[]) => void) => {
        capturedRecipe = recipe;
        return () => stubPatchCollection;
      },
    );

    undoAction(store.dispatch as any, store.getState as any);

    const draft = [{ id: '1', name: 'Changed' }];
    capturedRecipe!(draft);
    expect((draft[0] as any).name).toBe('Original');
  });
});

describe('undoAction with isOrderLocked', () => {
  it('skips the transaction when the predicate returns true for a string queryArg', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] });
    history.reset({ past: [tx] });
    const store = makeStore();

    undoAction(store.dispatch as any, store.getState as any, id => id === 'order-1');

    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(history.past).toHaveLength(1);
    expect(history.future).toHaveLength(0);
  });

  it('skips when the predicate returns true for any order in the transaction', () => {
    const tx = makeTx({
      diffs: [
        makeDiff({ queryArg: 'order-1' }),
        makeDiff({ id: 'diff-2', queryArg: 'order-2' }),
      ],
    });
    history.reset({ past: [tx] });
    const store = makeStore();

    undoAction(store.dispatch as any, store.getState as any, id => id === 'order-2');

    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(history.past).toHaveLength(1);
  });

  it('skips when the predicate returns true for a queryArg.orderId (searchItems endpoint)', () => {
    const tx = makeTx({ diffs: [makeDiff({ endpointName: 'searchItems', queryArg: { orderId: 'order-1' } })] });
    history.reset({ past: [tx] });
    const store = makeStore();

    undoAction(store.dispatch as any, store.getState as any, id => id === 'order-1');

    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(history.past).toHaveLength(1);
  });

  it('undoes normally when the predicate returns false for all touched orders', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] });
    history.reset({ past: [tx] });
    const store = makeStore();

    undoAction(store.dispatch as any, store.getState as any, () => false);

    expect(mockUpdateQueryData).toHaveBeenCalledTimes(1);
    expect(history.past).toHaveLength(0);
    expect(history.future).toHaveLength(1);
  });

  it('passes the current redux state to the predicate', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] });
    history.reset({ past: [tx] });
    const store = makeStore();
    const isOrderLocked = jest.fn().mockReturnValue(false);

    undoAction(store.dispatch as any, store.getState as any, isOrderLocked);

    expect(isOrderLocked).toHaveBeenCalledWith('order-1', expect.any(Object));
  });

  it('calls the predicate once per unique ID extracted from the transaction', () => {
    const tx = makeTx({
      diffs: [
        makeDiff({ queryArg: 'ws-1' }),
        makeDiff({ id: 'diff-2', endpointName: 'searchItems', queryArg: { orderId: 'order-2' } }),
      ],
    });
    history.reset({ past: [tx] });
    const store = makeStore();
    const isOrderLocked = jest.fn().mockReturnValue(false);

    undoAction(store.dispatch as any, store.getState as any, isOrderLocked);

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
    redoAction(store.dispatch as any);
    expect(mockUpdateQueryData).not.toHaveBeenCalled();
    expect(history.future).toHaveLength(0);
  });

  it('calls api.util.updateQueryData for each diff and moves the transaction to past', () => {
    const tx = makeTx();
    history.reset({ future: [tx] });
    const store = makeStore();

    redoAction(store.dispatch as any);

    expect(mockUpdateQueryData).toHaveBeenCalledWith('getOrders', 'order-1', expect.any(Function));
    expect(history.future).toHaveLength(0);
    expect(history.past[0].id).toBe('tx-1');
  });

  it('redo recipe re-applies a field change to its after value', () => {
    const diff = makeDiff({
      edits: [{ path: '[id=1]/name', op: 'replace', before: 'Original', after: 'Changed' }],
    });
    history.reset({ future: [makeTx({ diffs: [diff] })] });
    const store = makeStore();

    let capturedRecipe: ((draft: unknown[]) => void) | null = null;
    mockUpdateQueryData.mockImplementation(
      (_ep: string, _arg: unknown, recipe: (draft: unknown[]) => void) => {
        capturedRecipe = recipe;
        return () => stubPatchCollection;
      },
    );

    redoAction(store.dispatch as any);

    const draft = [{ id: '1', name: 'Original' }];
    capturedRecipe!(draft);
    expect((draft[0] as any).name).toBe('Changed');
  });
});
