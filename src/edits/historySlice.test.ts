import reducer, {
  historyActions,
  selectCanUndo,
  selectCanRedo,
  selectPastTransactions,
  type HistoryState,
} from './historySlice';
import type { CacheDiff, Transaction } from 'types/CacheDiff';

const BASE: HistoryState = {
  past: [],
  future: [],
  pending: [],
  inTransaction: false,
  maxSize: Infinity,
};

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

describe('historySlice reducer', () => {
  describe('push', () => {
    it('outside a transaction: commits a single-diff transaction and clears future', () => {
      const state: HistoryState = { ...BASE, future: [makeTx({ id: 'old' })] };
      const diff = makeDiff();
      const next = reducer(state, historyActions.push(diff));
      expect(next.past).toHaveLength(1);
      expect(next.past[0].diffs).toEqual([diff]);
      expect(next.future).toEqual([]);
    });

    it('inside a transaction: buffers into pending, does not touch past', () => {
      const state: HistoryState = { ...BASE, inTransaction: true };
      const diff = makeDiff();
      const next = reducer(state, historyActions.push(diff));
      expect(next.pending).toEqual([diff]);
      expect(next.past).toHaveLength(0);
    });
  });

  describe('beginTransaction', () => {
    it('sets inTransaction and clears any stale pending diffs', () => {
      const state: HistoryState = { ...BASE, pending: [makeDiff()] };
      const next = reducer(state, historyActions.beginTransaction());
      expect(next.inTransaction).toBe(true);
      expect(next.pending).toEqual([]);
    });
  });

  describe('commitTransaction', () => {
    it('with pending diffs: bundles them as one transaction using the first diff timestamp', () => {
      const d1 = makeDiff({ id: 'd1', timestamp: 100 });
      const d2 = makeDiff({ id: 'd2', timestamp: 200 });
      const state: HistoryState = { ...BASE, inTransaction: true, pending: [d1, d2] };
      const next = reducer(state, historyActions.commitTransaction());
      expect(next.past).toHaveLength(1);
      expect(next.past[0].diffs).toEqual([d1, d2]);
      expect(next.past[0].timestamp).toBe(100);
      expect(next.inTransaction).toBe(false);
      expect(next.pending).toEqual([]);
      expect(next.future).toEqual([]);
    });

    it('with no pending diffs: does not add to past', () => {
      const state: HistoryState = { ...BASE, inTransaction: true };
      const next = reducer(state, historyActions.commitTransaction());
      expect(next.past).toHaveLength(0);
      expect(next.inTransaction).toBe(false);
    });
  });

  describe('undo', () => {
    it('moves the last past transaction to the front of future', () => {
      const tx1 = makeTx({ id: 'tx1' });
      const tx2 = makeTx({ id: 'tx2' });
      const next = reducer({ ...BASE, past: [tx1, tx2] }, historyActions.undo());
      expect(next.past).toEqual([tx1]);
      expect(next.future).toEqual([tx2]);
    });

    it('is a no-op when past is empty', () => {
      const next = reducer(BASE, historyActions.undo());
      expect(next.past).toEqual([]);
      expect(next.future).toEqual([]);
    });
  });

  describe('redo', () => {
    it('moves the first future transaction to past', () => {
      const tx1 = makeTx({ id: 'tx1' });
      const tx2 = makeTx({ id: 'tx2' });
      const next = reducer({ ...BASE, future: [tx1, tx2] }, historyActions.redo());
      expect(next.past).toEqual([tx1]);
      expect(next.future).toEqual([tx2]);
    });

    it('is a no-op when future is empty', () => {
      const next = reducer(BASE, historyActions.redo());
      expect(next.past).toEqual([]);
      expect(next.future).toEqual([]);
    });
  });

  describe('setMaxSize', () => {
    it('trims oldest past entries to stay within maxSize', () => {
      const state: HistoryState = {
        ...BASE,
        past: [makeTx({ id: 'tx1' }), makeTx({ id: 'tx2' }), makeTx({ id: 'tx3' })],
      };
      const next = reducer(state, historyActions.setMaxSize(2));
      expect(next.past).toHaveLength(2);
      expect(next.past[0].id).toBe('tx2');
      expect(next.past[1].id).toBe('tx3');
      expect(next.maxSize).toBe(2);
    });

    it('does not trim when past is within maxSize', () => {
      const state: HistoryState = { ...BASE, past: [makeTx()] };
      const next = reducer(state, historyActions.setMaxSize(5));
      expect(next.past).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('resets past, future, pending, and inTransaction', () => {
      const state: HistoryState = {
        past: [makeTx()],
        future: [makeTx({ id: 'tx-f' })],
        pending: [makeDiff()],
        inTransaction: true,
        maxSize: 10,
      };
      const next = reducer(state, historyActions.clear());
      expect(next.past).toEqual([]);
      expect(next.future).toEqual([]);
      expect(next.pending).toEqual([]);
      expect(next.inTransaction).toBe(false);
    });
  });

  describe('purgeByIds', () => {
    it('removes past transactions whose queryArg matches an order id (string)', () => {
      const state: HistoryState = {
        ...BASE,
        past: [makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] })],
        future: [makeTx({ id: 'tx-f', diffs: [makeDiff({ id: 'd2', queryArg: 'order-2' })] })],
      };
      const next = reducer(state, historyActions.purgeByIds(['order-1']));
      expect(next.past).toHaveLength(0);
      expect(next.future).toHaveLength(1);
    });

    it('removes transactions whose queryArg.orderId matches (searchItems endpoint)', () => {
      const state: HistoryState = {
        ...BASE,
        past: [makeTx({ diffs: [makeDiff({ endpointName: 'searchItems', queryArg: { orderId: 'order-1' } })] })],
      };
      const next = reducer(state, historyActions.purgeByIds(['order-1']));
      expect(next.past).toHaveLength(0);
    });

    it('removes transactions where an edit path starts with [id=<orderId>]', () => {
      const diff = makeDiff({
        queryArg: 'unrelated',
        edits: [{ path: '[id=order-1]/name', op: 'replace', before: 'a', after: 'b' }],
      });
      const state: HistoryState = { ...BASE, past: [makeTx({ diffs: [diff] })] };
      const next = reducer(state, historyActions.purgeByIds(['order-1']));
      expect(next.past).toHaveLength(0);
    });

    it('keeps transactions that do not touch any supplied order id', () => {
      const state: HistoryState = {
        ...BASE,
        past: [makeTx({ diffs: [makeDiff({ queryArg: 'order-99' })] })],
      };
      const next = reducer(state, historyActions.purgeByIds(['order-1']));
      expect(next.past).toHaveLength(1);
    });

    it('also purges matching diffs from pending', () => {
      const state: HistoryState = {
        ...BASE,
        pending: [makeDiff({ queryArg: 'order-1' }), makeDiff({ id: 'diff-2', queryArg: 'order-99' })],
      };
      const next = reducer(state, historyActions.purgeByIds(['order-1']));
      expect(next.pending).toHaveLength(1);
      expect(next.pending[0].id).toBe('diff-2');
    });
  });
});

describe('selectors', () => {
  const mkRoot = (override: Partial<HistoryState> = {}) => ({
    history: { ...BASE, ...override },
  });

  it('selectCanUndo is true when past has entries', () => {
    expect(selectCanUndo(mkRoot({ past: [makeTx()] }))).toBe(true);
    expect(selectCanUndo(mkRoot())).toBe(false);
  });

  it('selectCanRedo is true when future has entries', () => {
    expect(selectCanRedo(mkRoot({ future: [makeTx()] }))).toBe(true);
    expect(selectCanRedo(mkRoot())).toBe(false);
  });

  it('selectPastTransactions returns the past array', () => {
    const tx = makeTx();
    expect(selectPastTransactions(mkRoot({ past: [tx] }))).toEqual([tx]);
  });
});
