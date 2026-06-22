import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { api } from './features/api/apiSlice';

let store: ReturnType<typeof getStore>;

const getStore = (initialState: Record<string, unknown> = {}) => {
  const rootReducer = combineReducers({
    [api.reducerPath]: api.reducer,
  });

  const newStore = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
    preloadedState: initialState as Parameters<typeof configureStore>[0]['preloadedState'],
  });

  setupListeners(newStore.dispatch);

  return newStore;
};

const setupStore = (initialState?: Record<string, unknown>) => {
  store = getStore(initialState);
  return store;
};

const resetStore = () => { store = getStore(); };

export { setupStore, resetStore };
