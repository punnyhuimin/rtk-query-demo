import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { RootState } from 'app/store';

interface ItemState {
  selectedItemId: string | undefined;
}

const initialState: ItemState = {
  selectedItemId: undefined,
};

export const itemSlice = createSlice({
  name: 'item',
  initialState,
  reducers: {
    selectItemId: (state, action: PayloadAction<string>) => {
      state.selectedItemId = action.payload;
    },
    clearSelectedItemId: (state) => {
      state.selectedItemId = undefined;
    },
  },
});

export const { selectItemId, clearSelectedItemId } = itemSlice.actions;

export default itemSlice.reducer;

export const useSelectedItemId = () =>
  useSelector((state: RootState) => state.item.selectedItemId);
