import { HistoryStore } from './history';
import type { CacheDiff, Transaction } from 'types/CacheDiff';

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

describe('HistoryStore', () => {
  let store: HistoryStore;
  beforeEach(() => { store = new HistoryStore(); });

  describe('push', () => {
    it('outside a transaction: silently drops the diff', () => {
      store.future = [makeTx({ id: 'old' })];
      store.push(makeDiff());
      expect(store.past).toHaveLength(0);
      expect(store.future).toHaveLength(1);
    });

    it('inside a transaction: buffers into pending, does not touch past', () => {
      store.beginTransaction();
      const diff = makeDiff();
      store.push(diff);
      expect(store.pending).toEqual([diff]);
      expect(store.past).toHaveLength(0);
    });
  });

  describe('beginTransaction', () => {
    it('sets inTransaction and clears any stale pending diffs', () => {
      store.pending = [makeDiff()];
      store.beginTransaction();
      expect(store.inTransaction).toBe(true);
      expect(store.pending).toEqual([]);
    });

    it('nested: does not clear pending on inner beginTransaction', () => {
      store.beginTransaction();
      store.push(makeDiff());
      store.beginTransaction();
      expect(store.pending).toHaveLength(1);
      expect(store.inTransaction).toBe(true);
    });
  });

  describe('commitTransaction', () => {
    it('with pending diffs: bundles them as one transaction using the first diff timestamp', () => {
      const d1 = makeDiff({ id: 'd1', timestamp: 100 });
      const d2 = makeDiff({ id: 'd2', timestamp: 200 });
      store.beginTransaction();
      store.push(d1);
      store.push(d2);
      store.commitTransaction();
      expect(store.past).toHaveLength(1);
      expect(store.past[0].diffs).toEqual([d1, d2]);
      expect(store.past[0].timestamp).toBe(100);
      expect(store.inTransaction).toBe(false);
      expect(store.pending).toEqual([]);
      expect(store.future).toEqual([]);
    });

    it('with no pending diffs: does not add to past', () => {
      store.beginTransaction();
      store.commitTransaction();
      expect(store.past).toHaveLength(0);
      expect(store.inTransaction).toBe(false);
    });

    it('nested: inner commitTransaction does not commit to past', () => {
      store.beginTransaction();
      store.push(makeDiff());
      store.beginTransaction();
      store.commitTransaction(); // inner commit
      expect(store.past).toHaveLength(0);
      expect(store.inTransaction).toBe(true);
    });

    it('nested: outer commitTransaction bundles all diffs into one transaction', () => {
      store.beginTransaction();
      store.push(makeDiff({ id: 'd1' }));
      store.beginTransaction();
      store.push(makeDiff({ id: 'd2' }));
      store.commitTransaction(); // inner
      store.commitTransaction(); // outer
      expect(store.past).toHaveLength(1);
      expect(store.past[0].diffs).toHaveLength(2);
      expect(store.inTransaction).toBe(false);
    });
  });

  describe('undo', () => {
    it('moves the last past transaction to the front of future', () => {
      const tx1 = makeTx({ id: 'tx1' });
      const tx2 = makeTx({ id: 'tx2' });
      store.reset({ past: [tx1, tx2] });
      store.undo();
      expect(store.past).toEqual([tx1]);
      expect(store.future).toEqual([tx2]);
    });

    it('is a no-op when past is empty', () => {
      store.undo();
      expect(store.past).toEqual([]);
      expect(store.future).toEqual([]);
    });
  });

  describe('redo', () => {
    it('moves the first future transaction to past', () => {
      const tx1 = makeTx({ id: 'tx1' });
      const tx2 = makeTx({ id: 'tx2' });
      store.reset({ future: [tx1, tx2] });
      store.redo();
      expect(store.past).toEqual([tx1]);
      expect(store.future).toEqual([tx2]);
    });

    it('is a no-op when future is empty', () => {
      store.redo();
      expect(store.past).toEqual([]);
      expect(store.future).toEqual([]);
    });
  });

  describe('setMaxSize', () => {
    it('trims oldest past entries to stay within maxSize', () => {
      store.reset({ past: [makeTx({ id: 'tx1' }), makeTx({ id: 'tx2' }), makeTx({ id: 'tx3' })] });
      store.setMaxSize(2);
      expect(store.past).toHaveLength(2);
      expect(store.past[0].id).toBe('tx2');
      expect(store.past[1].id).toBe('tx3');
      expect(store.maxSize).toBe(2);
    });

    it('does not trim when past is within maxSize', () => {
      store.reset({ past: [makeTx()] });
      store.setMaxSize(5);
      expect(store.past).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('resets past, future, pending, and inTransaction', () => {
      store.reset({
        past: [makeTx()],
        future: [makeTx({ id: 'tx-f' })],
        pending: [makeDiff()],
        inTransaction: true,
      });
      store.clear();
      expect(store.past).toEqual([]);
      expect(store.future).toEqual([]);
      expect(store.pending).toEqual([]);
      expect(store.inTransaction).toBe(false);
    });
  });

  describe('purgeByIds', () => {
    it('removes past transactions whose queryArg matches an order id (string)', () => {
      store.reset({
        past: [makeTx({ diffs: [makeDiff({ queryArg: 'order-1' })] })],
        future: [makeTx({ id: 'tx-f', diffs: [makeDiff({ id: 'd2', queryArg: 'order-2' })] })],
      });
      store.purgeByIds(['order-1']);
      expect(store.past).toHaveLength(0);
      expect(store.future).toHaveLength(1);
    });

    it('removes transactions whose queryArg.orderId matches (searchItems endpoint)', () => {
      store.reset({
        past: [makeTx({ diffs: [makeDiff({ endpointName: 'searchItems', queryArg: { orderId: 'order-1' } })] })],
      });
      store.purgeByIds(['order-1']);
      expect(store.past).toHaveLength(0);
    });

    it('removes transactions where an edit path starts with [id=<orderId>]', () => {
      const diff = makeDiff({
        queryArg: 'unrelated',
        edits: [{ path: '[id=order-1]/name', op: 'replace', before: 'a', after: 'b' }],
      });
      store.reset({ past: [makeTx({ diffs: [diff] })] });
      store.purgeByIds(['order-1']);
      expect(store.past).toHaveLength(0);
    });

    it('keeps transactions that do not touch any supplied order id', () => {
      store.reset({ past: [makeTx({ diffs: [makeDiff({ queryArg: 'order-99' })] })] });
      store.purgeByIds(['order-1']);
      expect(store.past).toHaveLength(1);
    });

    it('also purges matching diffs from pending', () => {
      store.reset({
        pending: [makeDiff({ queryArg: 'order-1' }), makeDiff({ id: 'diff-2', queryArg: 'order-99' })],
      });
      store.purgeByIds(['order-1']);
      expect(store.pending).toHaveLength(1);
      expect(store.pending[0].id).toBe('diff-2');
    });
  });

  describe('getSnapshot', () => {
    it('canUndo is true when past has entries', () => {
      store.reset({ past: [makeTx()] });
      expect(store.getSnapshot().canUndo).toBe(true);
      store.undo();
      expect(store.getSnapshot().canUndo).toBe(false);
    });

    it('canRedo is true when future has entries', () => {
      store.reset({ past: [makeTx()] });
      store.undo();
      expect(store.getSnapshot().canRedo).toBe(true);
      store.redo();
      expect(store.getSnapshot().canRedo).toBe(false);
    });

    it('past reflects the current past array', () => {
      const tx = makeTx();
      store.reset({ past: [tx] });
      expect(store.getSnapshot().past).toHaveLength(1);
      expect(store.getSnapshot().past[0].diffs[0]).toEqual(tx.diffs[0]);
    });

    it('returns a new object reference after each mutation', () => {
      const snap1 = store.getSnapshot();
      store.reset({ past: [makeTx()] });
      const snap2 = store.getSnapshot();
      expect(snap2).not.toBe(snap1);
    });
  });
});
