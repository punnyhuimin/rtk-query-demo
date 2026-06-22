import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { RootState } from 'app/store';

interface ItemState {
  initialOrderItemIds: Record<string, string[]>;
}

const initialState: ItemState = {
  initialOrderItemIds: {},
};

export const itemSlice = createSlice({
  name: 'item',
  initialState,
  reducers: {
    saveInitialOrderItemIds: (state, action: PayloadAction<{ orderId: string; itemIds: string[] }>) => {
      const { orderId, itemIds } = action.payload;
      state.initialOrderItemIds[orderId] = itemIds;
    },
    clearInitialOrderItemIds: (state, action: PayloadAction<string>) => {
      const orderId = action.payload;
      delete state.initialOrderItemIds[orderId];
    },
  },
});

export const { saveInitialOrderItemIds, clearInitialOrderItemIds: clearOrderItemIds } = itemSlice.actions;

export default itemSlice.reducer;

export const useInitialOrderItemIds = (orderId: string) => useSelector(
  (state: RootState) => state.item.initialOrderItemIds[orderId],
);
