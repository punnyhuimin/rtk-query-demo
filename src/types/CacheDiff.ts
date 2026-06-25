export interface FieldEdit {
  /** Stable id-based path, e.g. "[id=abc]/name" or "[id=abc]/location/lat" */
  path: string;
  op: 'replace' | 'add' | 'remove';
  before: unknown;
  after: unknown;
}

export interface CacheDiff {
  id: string;
  timestamp: number;
  endpointName: string;
  queryArg: unknown;
  edits: FieldEdit[];
  /** Raw Immer patches — kept for diagnostics; undo/redo uses id-based edits above */
  patches: ImmerPatch[];
  inversePatches: ImmerPatch[];
}

export interface ImmerPatch {
  op: 'replace' | 'add' | 'remove';
  path: (string | number)[];
  value?: unknown;
}

/**
 * One undoable unit — wraps one or more CacheDiffs that must undo/redo together.
 * A single updateQueryData call = one diff = one transaction.
 * A user action that touches multiple caches (e.g. item + order) = multiple diffs,
 * one transaction.
 */
export interface Transaction {
  id: string;
  timestamp: number;
  diffs: CacheDiff[];
}
