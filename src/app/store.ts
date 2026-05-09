import { configureStore } from '@reduxjs/toolkit';
import { contentApi } from './contentApi';

export const store = configureStore({
  reducer: {
    [contentApi.reducerPath]: contentApi.reducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(contentApi.middleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
