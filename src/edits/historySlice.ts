import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CacheDiff, Transaction } from 'types/CacheDiff';

export interface HistoryState {
  past: Transaction[];
  future: Transaction[];
  /** Diffs buffered between beginTransaction / commitTransaction */
  pending: CacheDiff[];
  inTransaction: boolean;
}

const initialState: HistoryState = {
  past: [],
  future: [],
  pending: [],
  inTransaction: false,
};

let _txSeq = 0;
const newTxId = () => `tx${(++_txSeq).toString(36)}-${Date.now().toString(36)}`;

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    /**
     * Called by trackableUpdateQueryData after every successful cache mutation.
     * - Outside a transaction: committed immediately as a single-diff transaction.
     * - Inside a transaction: buffered in `pending` until commitTransaction.
     */
    push(state, { payload }: PayloadAction<CacheDiff>) {
      if (state.inTransaction) {
        state.pending.push(payload);
      } else {
        state.past.push({ id: payload.id, timestamp: payload.timestamp, diffs: [payload] });
        state.future = [];
      }
    },

    /** Open a transaction. All subsequent push()es go into pending. */
    beginTransaction(state) {
      state.inTransaction = true;
      state.pending = [];
    },

    /**
     * Close a transaction and commit pending diffs as one undoable unit.
     * If no diffs were collected the transaction is a no-op.
     */
    commitTransaction(state) {
      if (state.pending.length > 0) {
        const first = state.pending[0];
        state.past.push({
          id: newTxId(),
          timestamp: first.timestamp,
          diffs: [...state.pending],
        });
        state.future = [];
      }
      state.pending = [];
      state.inTransaction = false;
    },

    undo(state) {
      const tx = state.past.pop();
      if (tx) state.future.unshift(tx);
    },

    redo(state) {
      const tx = state.future.shift();
      if (tx) state.past.push(tx);
    },

    clear(state) {
      state.past = [];
      state.future = [];
      state.pending = [];
      state.inTransaction = false;
    },
  },
});

export const historyActions = historySlice.actions;
export default historySlice.reducer;

// Selectors typed against a local shape to avoid a circular dep with store.ts
type HistoryRoot = { history: HistoryState };
export const selectHistory = (state: HistoryRoot) => state.history;
export const selectCanUndo = (state: HistoryRoot) => state.history.past.length > 0;
export const selectCanRedo = (state: HistoryRoot) => state.history.future.length > 0;
export const selectPastTransactions = (state: HistoryRoot) => state.history.past;
