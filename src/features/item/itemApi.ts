import { nanoid } from '@reduxjs/toolkit';
import { api } from 'features/api/apiSlice';
import { updateOrderAction } from 'features/order/orderApi';
import { providesId } from 'features/api/utils';
import { trackableUpdateQueryData } from 'edits/trackableUpdate';
import { historyActions } from 'edits/historySlice';
import { saveInitialOrderItemIds } from './itemSlice';
import { store } from 'app/store';
import type { AppDispatch } from 'app/store';
import type { Item, Warehouse } from 'types';

const invalidatesTags = (_result: unknown, _error: unknown, arg: any) => [
  { type: 'OrderItems' as const, id: arg.orderId ?? arg },
];

export const itemApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getItemById: builder.query<Item, string>({
      query: (id) => `item/${id}`,
      providesTags: (result, error, id) => providesId(result, id, 'Item'),
    }),
    searchItems: builder.query<Item[], { orderId: string | undefined }>({
      query: ({ orderId }) => ({
        url: `searchItems${orderId ? `?orderId=${orderId}` : ''}`,
        method: 'POST',
      }),
      serializeQueryArgs: ({ queryArgs }) => {
        const { orderId } = queryArgs;
        return `searchItems(${JSON.stringify(orderId)})`;
      },
      providesTags: (result, error, { orderId }) => providesId(result, orderId!, 'OrderItems'),
      async onQueryStarted({ orderId }, { dispatch, queryFulfilled }) {
        const { data: items } = await queryFulfilled;
        dispatch(saveInitialOrderItemIds({ orderId: orderId!, itemIds: items.map(i => i.id) }));
      },
    }),
    searchItemsBatch: builder.query<Record<string, Item[]>, { orderIds: string[] }>({
      queryFn: async ({ orderIds = [] }, _api, _extraOptions, baseQuery) => {
        const strippedOrderIds = [...orderIds];
        const cachedPartialData = orderIds.reduce<Record<string, Item[]>>((cachedItems, orderId) => {
          const { data: items } = itemApi.endpoints.searchItems.select({ orderId })(store.getState());
          if (items) {
            strippedOrderIds.splice(strippedOrderIds.indexOf(orderId), 1);
            cachedItems[orderId] = items;
          }
          return cachedItems;
        }, {});

        const result = strippedOrderIds.length > 0
          ? await baseQuery({
            url: 'searchItems',
            method: 'POST',
            body: { orderIds: strippedOrderIds },
          })
          : { data: {} as Record<string, Item[]> };

        const data = { ...cachedPartialData, ...(result.data as Record<string, Item[]>) };
        return { data };
      },
      keepUnusedDataFor: 0,
      providesTags: (result, _error, { orderIds }) => {
        return orderIds.reduce<{ type: string; id: string }[]>((tags, orderId) => {
          return tags.concat(providesId(result, orderId, 'OrderItemsBatch') as { type: string; id: string }[]);
        }, []);
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        Object.entries(data).forEach(([orderId, items]) => {
          const { data: searchItemsCache } = itemApi.endpoints.searchItems.select({ orderId })(store.getState());
          if (!searchItemsCache) {
            dispatch(api.util.upsertQueryData('searchItems', { orderId }, items));
          }
        });
      },
    }),
    upsertOrderItems: builder.mutation<Item[], { items: Item[]; orderId: string }>({
      query: ({ items, orderId }) => ({
        url: `item?orderId=${orderId}`,
        method: 'PUT',
        body: items,
      }),
      invalidatesTags: invalidatesTags as any,
    }),
    upsertAndDeleteOrderItems: builder.mutation<
      { upserted: unknown; deleted: unknown },
      { orderId: string; upsertItems: Item[]; deleteIds: string[] }
    >({
      async queryFn({ orderId, upsertItems, deleteIds }, _queryApi, _extraOptions, baseQuery) {
        const [upserted, deleted] = await Promise.all([
          upsertItems.length > 0 ? baseQuery({
            url: `item?orderId=${orderId}`,
            method: 'PUT',
            body: upsertItems,
          }) : Promise.resolve([]),
          deleteIds.length > 0 ? baseQuery({
            url: 'item',
            method: 'DELETE',
            body: deleteIds,
          }) : Promise.resolve([]),
        ]);
        return { data: { upserted, deleted } };
      },
      invalidatesTags: invalidatesTags as any,
    }),
    deleteOrderItems: builder.mutation<unknown, string>({
      query: (orderId) => ({
        url: `item?orderId=${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: invalidatesTags as any,
    }),
  }),
});

export const {
  useGetItemByIdQuery,
  useUpsertOrderItemsMutation,
  useDeleteOrderItemsMutation,
  useUpsertAndDeleteOrderItemsMutation,
  useSearchItemsBatchQuery,
} = itemApi;

const { useSearchItemsQuery } = itemApi;

export const useSearchItemsQueryState = itemApi.endpoints.searchItems.useQueryState;

export const useGetOrderItemsQuery = (orderIds: string | string[] = [], options?: Record<string, unknown>) => {
  const orderIdsArray = Array.isArray(orderIds) ? orderIds : [orderIds];
  if (orderIdsArray.length <= 1) {
    return useSearchItemsQuery(
      { orderId: orderIdsArray[0] },
      { skip: orderIdsArray.length === 0, ...options }
    );
  }
  return useSearchItemsBatchQuery({ orderIds: orderIdsArray }, options);
};

const invalidateBatchItemsResults = (dispatch: (action: unknown) => void, orderId: string) => {
  dispatch(api.util.invalidateTags([{ type: 'OrderItemsBatch', id: orderId }]));
};

export const editOrderItemAction = (orderId: string, editedItem: Item) => (dispatch: AppDispatch) => {
  dispatch(historyActions.beginTransaction());
  dispatch(trackableUpdateQueryData(
    'searchItems', { orderId }, (draftItems: Item[]) => {
      const item = draftItems.find(o => o.id === editedItem.id);
      if (!item) return;
      Object.assign(item, editedItem);
      item.__isDirty = true;
    }
  ));
  dispatch(updateOrderAction(orderId));
  dispatch(historyActions.commitTransaction());
  invalidateBatchItemsResults(dispatch, orderId);
};

export const addOrderItemAction = (orderId: string, newItem: Item) => (dispatch: AppDispatch) => {
  dispatch(historyActions.beginTransaction());
  dispatch(trackableUpdateQueryData(
    'searchItems', { orderId }, (draftItems: Item[]) => {
      draftItems.push({ ...newItem, __isDirty: true });
    }
  ));
  dispatch(updateOrderAction(
    orderId,
    (draftOrder) => { draftOrder.itemsCount = '...'; },
  ));
  dispatch(historyActions.commitTransaction());
  invalidateBatchItemsResults(dispatch, orderId);
};

export const deleteOrderItemAction = (orderId: string, itemId: string) => (dispatch: AppDispatch) => {
  dispatch(historyActions.beginTransaction());
  dispatch(trackableUpdateQueryData(
    'searchItems', { orderId }, (draftItems: Item[]) => {
      const idx = draftItems.findIndex(o => o.id === itemId);
      if (idx !== -1) draftItems.splice(idx, 1);
    }
  ));
  dispatch(updateOrderAction(orderId));
  dispatch(historyActions.commitTransaction());
  invalidateBatchItemsResults(dispatch, orderId);
};

/**
 * Adjusts item.warehouses to match newCount.
 * Increasing adds default warehouses; decreasing removes from the end.
 * Both the warehouseCount field and the warehouses array change atomically
 * in one transaction so a single Ctrl+Z reverts both.
 */
export const setWarehouseCountAction = (
  orderId: string,
  itemId: string,
  newCount: number,
) => (dispatch: AppDispatch) => {
  dispatch(historyActions.beginTransaction());
  dispatch(trackableUpdateQueryData(
    'searchItems', { orderId }, (draftItems: Item[]) => {
      const item = draftItems.find(o => o.id === itemId);
      if (!item) return;

      const current = item.warehouses?.length ?? 0;
      if (newCount > current) {
        if (!item.warehouses) item.warehouses = [];
        for (let i = current; i < newCount; i++) {
          const w: Warehouse = { id: nanoid(), name: `Warehouse ${i + 1}` };
          item.warehouses.push(w);
        }
      } else if (newCount < current) {
        item.warehouses = item.warehouses.slice(0, newCount);
      }

      item.warehouseCount = newCount;
      item.__isDirty = true;
    }
  ));
  dispatch(updateOrderAction(orderId));
  dispatch(historyActions.commitTransaction());
  invalidateBatchItemsResults(dispatch, orderId);
};

export const clearOrderItemsAction = (orderId: string) => (dispatch: AppDispatch) => {
  dispatch(historyActions.beginTransaction());
  dispatch(trackableUpdateQueryData(
    'searchItems', { orderId }, (draftItems: Item[]) => {
      draftItems.length = 0;
    }
  ));
  dispatch(updateOrderAction(orderId));
  dispatch(historyActions.commitTransaction());
  invalidateBatchItemsResults(dispatch, orderId);
};
