import { api } from 'features/api/apiSlice';
import { updateOrderAction } from 'features/order/orderApi';
import { providesId } from 'features/api/utils';
import { saveInitialOrderVehicleIds } from './vehicleSlice';
import { store } from 'app/store';
import type { Vehicle } from 'types';

const invalidatesTags = (_result: unknown, _error: unknown, arg: any) => [
  { type: 'OrderVehicles' as const, id: arg.orderId ?? arg },
];

export const vehicleApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getVehicleById: builder.query<Vehicle, string>({
      query: (id) => `vehicle/${id}`,
      providesTags: (result, error, id) => providesId(result, id, 'Vehicle'),
    }),
    searchVehicles: builder.query<Vehicle[], { orderId: string | undefined }>({
      query: ({ orderId }) => ({
        url: `searchVehicles${orderId ? `?orderId=${orderId}` : ''}`,
        method: 'POST',
      }),
      serializeQueryArgs: ({ queryArgs }) => {
        const { orderId } = queryArgs;
        return `searchVehicles(${JSON.stringify(orderId)})`;
      },
      providesTags: (result, error, { orderId }) => providesId(result, orderId!, 'OrderVehicles'),
      async onQueryStarted({ orderId }, { dispatch, queryFulfilled }) {
        const { data: vehicles } = await queryFulfilled;
        dispatch(saveInitialOrderVehicleIds({ orderId: orderId!, vehicleIds: vehicles.map(v => v.id) }));
      },
    }),
    searchVehiclesBatch: builder.query<Record<string, Vehicle[]>, { orderIds: string[] }>({
      queryFn: async ({ orderIds = [] }, _api, _extraOptions, baseQuery) => {
        const strippedOrderIds = [...orderIds];
        const cachedPartialData = orderIds.reduce<Record<string, Vehicle[]>>((cachedVehicles, orderId) => {
          const { data: vehicles } = vehicleApi.endpoints.searchVehicles.select({ orderId })(store.getState());
          if (vehicles) {
            strippedOrderIds.splice(strippedOrderIds.indexOf(orderId), 1);
            cachedVehicles[orderId] = vehicles;
          }
          return cachedVehicles;
        }, {});

        const result = strippedOrderIds.length > 0
          ? await baseQuery({
            url: 'searchVehicles',
            method: 'POST',
            body: { orderIds: strippedOrderIds },
          })
          : { data: {} as Record<string, Vehicle[]> };

        const data = { ...cachedPartialData, ...(result.data as Record<string, Vehicle[]>) };
        return { data };
      },
      keepUnusedDataFor: 0,
      providesTags: (result, _error, { orderIds }) => {
        return orderIds.reduce<{ type: string; id: string }[]>((tags, orderId) => {
          return tags.concat(providesId(result, orderId, 'OrderVehiclesBatch') as { type: string; id: string }[]);
        }, []);
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        Object.entries(data).forEach(([orderId, vehicles]) => {
          const { data: searchVehiclesCache } = vehicleApi.endpoints.searchVehicles.select({ orderId })(store.getState());
          if (!searchVehiclesCache) {
            dispatch(api.util.upsertQueryData('searchVehicles', { orderId }, vehicles));
          }
        });
      },
    }),
    upsertOrderVehicles: builder.mutation<Vehicle[], { vehicles: Vehicle[]; orderId: string }>({
      query: ({ vehicles, orderId }) => ({
        url: `vehicle?orderId=${orderId}`,
        method: 'PUT',
        body: vehicles,
      }),
      invalidatesTags: invalidatesTags as any,
    }),
    upsertAndDeleteOrderVehicles: builder.mutation<
      { upserted: unknown; deleted: unknown },
      { orderId: string; upsertVehicles: Vehicle[]; deleteIds: string[] }
    >({
      async queryFn({ orderId, upsertVehicles, deleteIds }, _queryApi, _extraOptions, baseQuery) {
        const [upserted, deleted] = await Promise.all([
          upsertVehicles.length > 0 ? baseQuery({
            url: `vehicle?orderId=${orderId}`,
            method: 'PUT',
            body: upsertVehicles,
          }) : Promise.resolve([]),
          deleteIds.length > 0 ? baseQuery({
            url: 'vehicle',
            method: 'DELETE',
            body: deleteIds,
          }) : Promise.resolve([]),
        ]);
        return { data: { upserted, deleted } };
      },
      invalidatesTags: invalidatesTags as any,
    }),
    deleteOrderVehicles: builder.mutation<unknown, string>({
      query: (orderId) => ({
        url: `vehicle?orderId=${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: invalidatesTags as any,
    }),
  }),
});

export const {
  useGetVehicleByIdQuery,
  useUpsertOrderVehiclesMutation,
  useDeleteOrderVehiclesMutation,
  useUpsertAndDeleteOrderVehiclesMutation,
  useSearchVehiclesBatchQuery,
} = vehicleApi;

const { useSearchVehiclesQuery } = vehicleApi;

export const useSearchVehiclesQueryState = vehicleApi.endpoints.searchVehicles.useQueryState;

export const useGetOrderVehiclesQuery = (orderIds: string | string[] = [], options?: Record<string, unknown>) => {
  const orderIdsArray = Array.isArray(orderIds) ? orderIds : [orderIds];
  if (orderIdsArray.length <= 1) {
    return useSearchVehiclesQuery(
      { orderId: orderIdsArray[0] },
      { skip: orderIdsArray.length === 0, ...options }
    );
  }
  return useSearchVehiclesBatchQuery({ orderIds: orderIdsArray }, options);
};

const invalidateBatchVehiclesResults = (dispatch: (action: unknown) => void, orderId: string) => {
  dispatch(api.util.invalidateTags([{ type: 'OrderVehiclesBatch', id: orderId }]));
};

export const editOrderVehicleAction = (orderId: string, editedVehicle: Vehicle) => (dispatch: any) => {
  dispatch(vehicleApi.util.updateQueryData(
    'searchVehicles', { orderId }, (draftVehicles) => {
      const index = draftVehicles.findIndex(v => v.id === editedVehicle.id);
      draftVehicles[index] = { ...editedVehicle, __isDirty: true };
    }
  ));
  dispatch(updateOrderAction(orderId));
  invalidateBatchVehiclesResults(dispatch, orderId);
};

export const addOrderVehicleAction = (orderId: string, newVehicle: Vehicle) => (dispatch: any) => {
  dispatch(vehicleApi.util.updateQueryData(
    'searchVehicles', { orderId }, (draftVehicles) => {
      draftVehicles.push({ ...newVehicle, __isDirty: true });
    }
  ));
  dispatch(updateOrderAction(
    orderId,
    (draftOrder) => { draftOrder.vehicleCount = '...'; },
  ));
  invalidateBatchVehiclesResults(dispatch, orderId);
};

export const deleteOrderVehicleAction = (orderId: string, vehicleId: string) => (dispatch: any) => {
  dispatch(vehicleApi.util.updateQueryData(
    'searchVehicles', { orderId }, (draftVehicles) => {
      const index = draftVehicles.findIndex(v => v.id === vehicleId);
      if (index > -1) {
        draftVehicles.splice(index, 1);
      }
    }
  ));
  dispatch(updateOrderAction(orderId));
  invalidateBatchVehiclesResults(dispatch, orderId);
};

export const clearOrderVehiclesAction = (orderId: string) => (dispatch: any) => {
  dispatch(vehicleApi.util.updateQueryData(
    'searchVehicles', { orderId }, (draftVehicles) => {
      draftVehicles.length = 0;
    }
  ));
  dispatch(updateOrderAction(orderId));
  invalidateBatchVehiclesResults(dispatch, orderId);
};
