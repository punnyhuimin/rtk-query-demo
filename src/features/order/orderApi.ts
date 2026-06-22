import { api } from 'features/api/apiSlice';
import { providesList } from 'features/api/utils';
import type { Order } from 'types';

export const orderApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<Order[], void>({
      query: () => 'order',
      transformResponse: (orders: Order[]) => orders.map(o => ({ ...o, itemsCount: '...' })),
      providesTags: (result) => providesList(result ?? [], 'Order'),
    }),
    upsertOrder: builder.mutation<Order, Partial<Order>>({
      query: (order) => ({
        url: 'order',
        method: 'PUT',
        body: order,
      }),
      invalidatesTags: ['Order'],
    }),
    deleteOrder: builder.mutation<Order, string>({
      query: (orderId) => ({
        url: `order/${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Order'],
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
