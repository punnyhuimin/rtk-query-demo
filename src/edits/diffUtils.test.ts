import type { CacheDiff, Transaction } from 'types/CacheDiff';
import type { ApiQueryName } from 'features/api/endpointTypes';
import {
  extractOrderIdsFromTransaction,
  diffTouchesOrderIds,
  registerArgExtractor,
} from './diffUtils';

const makeDiff = (overrides: Partial<CacheDiff> = {}): CacheDiff => ({
  id: 'diff-1',
  timestamp: 1000,
  endpointName: 'getOrders',
  queryArg: 'ws-1',
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

// ---------------------------------------------------------------------------
// extractOrderIdsFromTransaction
// ---------------------------------------------------------------------------

describe('extractOrderIdsFromTransaction', () => {
  it('extracts a string queryArg directly', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: 'ws-1' })] });
    expect(extractOrderIdsFromTransaction(tx)).toContain('ws-1');
  });

  it('extracts orderId from a searchItems diff via the registered extractor', () => {
    const tx = makeTx({
      diffs: [makeDiff({ endpointName: 'searchItems', queryArg: { orderId: 'order-1' } })],
    });
    expect(extractOrderIdsFromTransaction(tx)).toContain('order-1');
  });

  it('extracts entity IDs from edit paths', () => {
    const tx = makeTx({
      diffs: [makeDiff({
        queryArg: null,
        edits: [{ path: '[id=order-1]/name', op: 'replace', before: 'a', after: 'b' }],
      })],
    });
    expect(extractOrderIdsFromTransaction(tx)).toContain('order-1');
  });

  it('extracts the ID from an entity-level path (no field segment)', () => {
    const tx = makeTx({
      diffs: [makeDiff({
        queryArg: null,
        edits: [{ path: '[id=order-1]', op: 'remove', before: { id: 'order-1' }, after: undefined }],
      })],
    });
    expect(extractOrderIdsFromTransaction(tx)).toContain('order-1');
  });

  it('does not extract IDs from paths that do not start with [id=]', () => {
    const tx = makeTx({
      diffs: [makeDiff({
        queryArg: null,
        edits: [{ path: 'name', op: 'replace', before: 'a', after: 'b' }],
      })],
    });
    expect(extractOrderIdsFromTransaction(tx)).toHaveLength(0);
  });

  it('deduplicates IDs that appear in multiple sources', () => {
    const tx = makeTx({
      diffs: [makeDiff({
        queryArg: null,
        edits: [
          { path: '[id=order-1]/name', op: 'replace', before: 'a', after: 'b' },
          { path: '[id=order-1]/status', op: 'replace', before: 'x', after: 'y' },
        ],
      })],
    });
    const ids = extractOrderIdsFromTransaction(tx);
    expect(ids.filter(id => id === 'order-1')).toHaveLength(1);
  });

  it('collects IDs from multiple diffs in the same transaction', () => {
    const tx = makeTx({
      diffs: [
        makeDiff({ queryArg: 'ws-1' }),
        makeDiff({ id: 'diff-2', endpointName: 'searchItems', queryArg: { orderId: 'order-1' } }),
      ],
    });
    const ids = extractOrderIdsFromTransaction(tx);
    expect(ids).toContain('ws-1');
    expect(ids).toContain('order-1');
  });

  it('produces no IDs from a null queryArg and no edits', () => {
    const tx = makeTx({ diffs: [makeDiff({ queryArg: null, edits: [] })] });
    expect(extractOrderIdsFromTransaction(tx)).toHaveLength(0);
  });

  it('produces no IDs from an object queryArg with no registered extractor', () => {
    const tx = makeTx({
      diffs: [makeDiff({ endpointName: 'unknownEndpoint' as ApiQueryName, queryArg: { someField: 'value' }, edits: [] })],
    });
    expect(extractOrderIdsFromTransaction(tx)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// diffTouchesOrderIds
// ---------------------------------------------------------------------------

describe('diffTouchesOrderIds', () => {
  it('returns true when the string queryArg matches an ID in the set', () => {
    const diff = makeDiff({ queryArg: 'ws-1' });
    expect(diffTouchesOrderIds(diff, new Set(['ws-1']))).toBe(true);
  });

  it('returns false when the string queryArg does not match', () => {
    const diff = makeDiff({ queryArg: 'ws-2' });
    expect(diffTouchesOrderIds(diff, new Set(['ws-1']))).toBe(false);
  });

  it('returns true when the registered extractor yields a matching ID (searchItems)', () => {
    const diff = makeDiff({
      endpointName: 'searchItems',
      queryArg: { orderId: 'order-1' },
    });
    expect(diffTouchesOrderIds(diff, new Set(['order-1']))).toBe(true);
  });

  it('returns false when the registered extractor yields no matching ID', () => {
    const diff = makeDiff({
      endpointName: 'searchItems',
      queryArg: { orderId: 'order-2' },
    });
    expect(diffTouchesOrderIds(diff, new Set(['order-1']))).toBe(false);
  });

  it('returns true when an edit path matches', () => {
    const diff = makeDiff({
      queryArg: null,
      edits: [{ path: '[id=order-1]/name', op: 'replace', before: 'a', after: 'b' }],
    });
    expect(diffTouchesOrderIds(diff, new Set(['order-1']))).toBe(true);
  });

  it('returns false when no queryArg or path matches', () => {
    const diff = makeDiff({
      queryArg: 'ws-99',
      edits: [{ path: '[id=order-99]/name', op: 'replace', before: 'a', after: 'b' }],
    });
    expect(diffTouchesOrderIds(diff, new Set(['ws-1', 'order-1']))).toBe(false);
  });

  it('returns false for a null queryArg with no matching paths', () => {
    const diff = makeDiff({ queryArg: null, edits: [] });
    expect(diffTouchesOrderIds(diff, new Set(['ws-1']))).toBe(false);
  });

  it('returns false for an object queryArg with no registered extractor', () => {
    const diff = makeDiff({
      endpointName: 'unknownEndpoint' as ApiQueryName,
      queryArg: { someField: 'ws-1' },
      edits: [],
    });
    expect(diffTouchesOrderIds(diff, new Set(['ws-1']))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// registerArgExtractor
// ---------------------------------------------------------------------------

describe('registerArgExtractor', () => {
  it('makes extractOrderIdsFromTransaction use the custom extractor', () => {
    registerArgExtractor('testEndpointA' as ApiQueryName, (arg) => [(arg as { packageId: string }).packageId]);

    const tx = makeTx({
      diffs: [makeDiff({ endpointName: 'testEndpointA' as ApiQueryName, queryArg: { packageId: 'pkg-1' }, edits: [] })],
    });
    expect(extractOrderIdsFromTransaction(tx)).toContain('pkg-1');
  });

  it('makes diffTouchesOrderIds use the custom extractor', () => {
    registerArgExtractor('testEndpointB' as ApiQueryName, (arg) => [(arg as { packageId: string }).packageId]);

    const diff = makeDiff({
      endpointName: 'testEndpointB' as ApiQueryName,
      queryArg: { packageId: 'pkg-2' },
      edits: [],
    });
    expect(diffTouchesOrderIds(diff, new Set(['pkg-2']))).toBe(true);
  });

  it('overrides an existing extractor for the same endpoint', () => {
    registerArgExtractor('testEndpointC' as ApiQueryName, () => ['original']);
    registerArgExtractor('testEndpointC' as ApiQueryName, () => ['overridden']);

    const tx = makeTx({
      diffs: [makeDiff({ endpointName: 'testEndpointC' as ApiQueryName, queryArg: {}, edits: [] })],
    });
    expect(extractOrderIdsFromTransaction(tx)).toContain('overridden');
    expect(extractOrderIdsFromTransaction(tx)).not.toContain('original');
  });
});
