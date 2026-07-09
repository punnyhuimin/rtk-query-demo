export interface FieldEdit {
  /** Stable id-based path, e.g. "[id=abc]/name" or "[id=abc]/location/lat" */
  path: string;
  op: 'replace' | 'add' | 'remove';
  before: unknown;
  after: unknown;
  /**
   * For entity-level add/remove: the entity's original index in the array.
   * Used by undo to splice the entity back at exactly the right position.
   */
  index?: number;
}

import type { Patch } from 'immer';
import type { ApiQueryName } from 'features/api/endpointTypes';

export type { Patch };

export interface CacheDiff {
  id: string;
  timestamp: number;
  endpointName: ApiQueryName;
  queryArg: unknown;
  edits: FieldEdit[];
  /** Raw Immer patches — kept for diagnostics; undo/redo uses id-based edits above */
  patches: Patch[];
  inversePatches: Patch[];
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
