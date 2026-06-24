import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { RootState } from 'app/store';

interface VehicleState {
  initialOrderVehicleIds: Record<string, string[]>;
}

const initialState: VehicleState = {
  initialOrderVehicleIds: {},
};

export const vehicleSlice = createSlice({
  name: 'vehicle',
  initialState,
  reducers: {
    saveInitialOrderVehicleIds: (state, action: PayloadAction<{ orderId: string; vehicleIds: string[] }>) => {
      const { orderId, vehicleIds } = action.payload;
      state.initialOrderVehicleIds[orderId] = vehicleIds;
    },
    clearInitialOrderVehicleIds: (state, action: PayloadAction<string>) => {
      const orderId = action.payload;
      delete state.initialOrderVehicleIds[orderId];
    },
  },
});

export const { saveInitialOrderVehicleIds, clearInitialOrderVehicleIds: clearOrderVehicleIds } = vehicleSlice.actions;

export default vehicleSlice.reducer;

export const useInitialOrderVehicleIds = (orderId: string) => useSelector(
  (state: RootState) => state.vehicle.initialOrderVehicleIds[orderId],
);
