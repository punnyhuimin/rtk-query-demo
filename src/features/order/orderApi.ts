import { api } from 'features/api/apiSlice';
import { providesList } from 'features/api/utils';
import { mergeRetainDirty } from 'mocks/services/utils';
import { trackableUpdateQueryData } from 'edits/trackableUpdate';
import { history } from 'edits/history';
import type { Order } from 'types';

export const orderApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<Order[], string>({
      query: (workspaceId) => `order?workspaceId=${workspaceId}`,
      transformResponse: (orders: Order[]) => orders.map(o => ({ ...o, itemsCount: '...' })),
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
      async onQueryStarted(order, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          if (order.workspaceId) {
            dispatch(
              orderApi.util.updateQueryData('getOrders', order.workspaceId, (draftOrders) => {
                const draftOrder = draftOrders.find(o => o.id === order.id);
                if (draftOrder) delete draftOrder.__isDirty;
              }),
            );
          }
          if (order.id) history.purgeByIds([order.id]);
        } catch { /* save failed — leave history intact */ }
      },
    }),
    deleteOrder: builder.mutation<Order, { orderId: string; workspaceId: string }>({
      query: ({ orderId }) => ({
        url: `order/${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Order'],
      async onQueryStarted({ orderId, workspaceId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            orderApi.util.updateQueryData('getOrders', workspaceId, (draftOrders) => {
              const draftOrder = draftOrders.find(o => o.id === orderId);
              if (draftOrder) delete draftOrder.__isDirty;
            }),
          );
        } catch { /* delete failed — leave cache intact */ }
      },
    }),
  }),
});

export const { useGetOrdersQuery, useUpsertOrderMutation, useDeleteOrderMutation } = orderApi;

export const useGetOrderByIdQuery = (
  orderId: string | undefined,
  workspaceId: string | undefined,
) => useGetOrdersQuery(workspaceId ?? '', {
  skip: !orderId || !workspaceId,
  selectFromResult: ({ data: orders }) => ({
    data: orders?.find(o => o.id === orderId),
  }),
});

export const updateOrderAction = (
  workspaceId: string,
  orderId: string,
  editedOrderOrFn?: Partial<Order> | ((draft: Order) => void),
) => trackableUpdateQueryData(
  'getOrders', workspaceId, (draftOrders: Order[]) => {
    const order = draftOrders.find(o => o.id === orderId);
    if (!order) return;
    if (typeof editedOrderOrFn === 'function') {
      editedOrderOrFn(order);
    } else if (editedOrderOrFn !== undefined) {
      Object.assign(order, editedOrderOrFn);
    }
    order.__isDirty = true;
  }
);
