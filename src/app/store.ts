import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { api } from 'features/api/apiSlice';
import orderReducer from 'features/order/orderSlice';
import vehicleReducer from 'features/vehicle/vehicleSlice';

export const store = configureStore({
  devTools: process.env.NODE_ENV === 'development',
  reducer: {
    [api.reducerPath]: api.reducer,
    order: orderReducer,
    vehicle: vehicleReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

setupListeners(store.dispatch);
