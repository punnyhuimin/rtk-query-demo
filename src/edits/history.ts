import type { CacheDiff, Transaction } from 'types/CacheDiff';
import { diffTouchesOrderIds } from './diffUtils';

let _txSeq = 0;
const newTxId = () => `tx${(++_txSeq).toString(36)}-${Date.now().toString(36)}`;

export interface HistorySnapshot {
  past: readonly Transaction[];
  future: readonly Transaction[];
  canUndo: boolean;
  canRedo: boolean;
}

export class HistoryStore {
  past: Transaction[] = [];
  future: Transaction[] = [];
  pending: CacheDiff[] = [];
  private _txDepth = 0;
  maxSize = Infinity;

  get inTransaction(): boolean { return this._txDepth > 0; }
  set inTransaction(v: boolean) { this._txDepth = v ? 1 : 0; }

  private _listeners = new Set<() => void>();
  private _snapshot: HistorySnapshot = { past: [], future: [], canUndo: false, canRedo: false };

  private notify(): void {
    this._snapshot = {
      past: this.past,
      future: this.future,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
    this._listeners.forEach(l => l());
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getSnapshot(): HistorySnapshot {
    return this._snapshot;
  }

  push(diff: CacheDiff): void {
    if (this.inTransaction) {
      this.pending = [...this.pending, diff];
    }
    // outside a transaction: silently drop — tracking is opt-in
  }

  beginTransaction(): void {
    if (this._txDepth === 0) this.pending = [];
    this._txDepth++;
  }

  commitTransaction(): void {
    if (this._txDepth === 0) return;
    this._txDepth--;
    if (this._txDepth > 0) return; // still inside an outer transaction
    if (this.pending.length > 0) {
      const first = this.pending[0];
      this.past = [...this.past, {
        id: newTxId(),
        timestamp: first.timestamp,
        diffs: [...this.pending],
      }];
      this.future = [];
      this.trim();
    }
    this.pending = [];
    this.notify();
  }

  undo(): void {
    const last = this.past[this.past.length - 1];
    if (!last) return;
    this.past = this.past.slice(0, -1);
    this.future = [last, ...this.future];
    this.notify();
  }

  redo(): void {
    const [first, ...rest] = this.future;
    if (!first) return;
    this.future = rest;
    this.past = [...this.past, first];
    this.trim();
    this.notify();
  }

  setMaxSize(n: number): void {
    this.maxSize = n;
    this.trim();
    this.notify();
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.pending = [];
    this._txDepth = 0;
    this.notify();
  }

  purgeByIds(ids: string[]): void {
    const idSet = new Set(ids);
    const txHasIds = (tx: Transaction) =>
      tx.diffs.some(diff => diffTouchesOrderIds(diff, idSet));
    this.past = this.past.filter(tx => !txHasIds(tx));
    this.future = this.future.filter(tx => !txHasIds(tx));
    this.pending = this.pending.filter(diff => !diffTouchesOrderIds(diff, idSet));
    this.notify();
  }

  private trim(): void {
    if (this.past.length > this.maxSize) {
      this.past = this.past.slice(this.past.length - this.maxSize);
    }
  }

  reset(override: Partial<{
    past: Transaction[];
    future: Transaction[];
    pending: CacheDiff[];
    inTransaction: boolean;
    maxSize: number;
  }> = {}): void {
    this.past = override.past ?? [];
    this.future = override.future ?? [];
    this.pending = override.pending ?? [];
    this.inTransaction = override.inTransaction ?? false;
    this.maxSize = override.maxSize ?? Infinity;
    this.notify();
  }
}

export const history = new HistoryStore();
