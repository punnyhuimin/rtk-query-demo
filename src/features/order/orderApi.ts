import { api } from 'features/api/apiSlice';
import { providesList } from 'features/api/utils';
import { mergeRetainDirty } from 'mocks/services/utils';
import type { Order } from 'types';

export const orderApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<Order[], void>({
      query: () => 'order',
      transformResponse: (orders: Order[]) => orders.map(o => ({ ...o, vehicleCount: '...' })),
      providesTags: (result) => providesList(result ?? [], 'Order'),
      merge: (currentCache, orders) => {
        const newCache = currentCache.filter(curr => curr.__isDirty || orders.some(o => o.id === curr.id));
        return mergeRetainDirty(newCache, orders, (curr, o) => curr.id === o.id);
      },
    }),
    upsertOrder: builder.mutation<Order, Partial<Order>>({
      query: (order) => ({
        url: 'order',
        method: 'PUT',
        body: order,
      }),
      invalidatesTags: ['Order'],
      async onQueryStarted(order, { dispatch }) {
        dispatch(
          orderApi.util.updateQueryData('getOrders', undefined, (draftOrders) => {
            const index = draftOrders.findIndex(o => o.id === order.id);
            if (index > -1) delete draftOrders[index].__isDirty;
          }),
        );
      },
    }),
    deleteOrder: builder.mutation<Order, string>({
      query: (orderId) => ({
        url: `order/${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Order'],
      async onQueryStarted(orderId, { dispatch }) {
        dispatch(
          orderApi.util.updateQueryData('getOrders', undefined, (draftOrders) => {
            const index = draftOrders.findIndex(o => o.id === orderId);
            delete draftOrders[index].__isDirty;
          }),
        );
      },
    }),
  }),
});

export const { useGetOrdersQuery, useUpsertOrderMutation, useDeleteOrderMutation } = orderApi;

export const useGetOrderByIdQuery = (orderId: string | undefined) => useGetOrdersQuery(undefined, {
  skip: !orderId,
  selectFromResult: ({ data: orders }) => ({
    data: orders?.find(o => o.id === orderId),
  }),
});

export const updateOrderAction = (
  orderId: string,
  editedOrderOrFn?: Partial<Order> | ((draft: Order) => void)
) => orderApi.util.updateQueryData(
  'getOrders', undefined, (draftOrders) => {
    const index = draftOrders.findIndex(o => o.id === orderId);
    if (typeof editedOrderOrFn === 'function') {
      editedOrderOrFn(draftOrders[index]);
    } else if (editedOrderOrFn !== undefined) {
      draftOrders[index] = { ...draftOrders[index], ...editedOrderOrFn };
    }
    draftOrders[index].__isDirty = true;
  }
);
