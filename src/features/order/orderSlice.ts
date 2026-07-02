import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { RootState } from 'app/store';

import { useGetOrderByIdQuery } from './orderApi';
import { selectSelectedWorkspaceId } from 'features/workspace/workspaceSlice';

interface OrderState {
  selectedOrderId: string | undefined;
}

const initialState: OrderState = {
  selectedOrderId: undefined,
};

export const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    selectOrderId: (state, action: PayloadAction<string>) => {
      state.selectedOrderId = action.payload;
    },
    clearSelectedOrderId: (state) => {
      state.selectedOrderId = undefined;
    },
  },
});

export const { selectOrderId, clearSelectedOrderId } = orderSlice.actions;

export default orderSlice.reducer;

export const useSelectedOrder = () => {
  const selectedOrderId = useSelector((state: RootState) => state.order.selectedOrderId);
  const selectedWorkspaceId = useSelector((state: RootState) => selectSelectedWorkspaceId(state));
  return useGetOrderByIdQuery(selectedOrderId, selectedWorkspaceId);
};
