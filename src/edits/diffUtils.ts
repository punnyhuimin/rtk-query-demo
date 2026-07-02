import type { CacheDiff, Transaction } from 'types/CacheDiff';

type ArgExtractor = (queryArg: unknown) => string[];

// Per-endpoint registry: maps endpoint name → function that extracts relevant IDs
// from that endpoint's queryArg. String queryArgs are always extracted directly.
// Register here for object-shaped args (e.g. searchItems uses { orderId }).
const argExtractors: Record<string, ArgExtractor> = {
  searchItems: (arg) => [(arg as { orderId: string }).orderId],
};

export function registerArgExtractor(endpointName: string, extractor: ArgExtractor): void {
  argExtractors[endpointName] = extractor;
}

function extractIdsFromQueryArg(endpointName: string, queryArg: unknown): string[] {
  if (typeof queryArg === 'string') return [queryArg];
  if (queryArg == null) return [];
  const extractor = argExtractors[endpointName];
  return extractor ? extractor(queryArg) : [];
}

export function extractOrderIdsFromTransaction(tx: Transaction): string[] {
  const ids = new Set<string>();
  for (const diff of tx.diffs) {
    extractIdsFromQueryArg(diff.endpointName, diff.queryArg).forEach(id => ids.add(id));
    for (const edit of diff.edits) {
      const match = edit.path.match(/^\[id=([^\]]+)\]/);
      if (match) ids.add(match[1]);
    }
  }
  return [...ids];
}

export function diffTouchesOrderIds(diff: CacheDiff, ids: Set<string>): boolean {
  if (extractIdsFromQueryArg(diff.endpointName, diff.queryArg).some(id => ids.has(id))) return true;
  return diff.edits.some(edit => {
    const match = edit.path.match(/^\[id=([^\]]+)\]/);
    return match != null && ids.has(match[1]);
  });
}
