import { api } from 'features/api/apiSlice';
import { providesId } from 'features/api/utils';
import { saveInitialOrderVehicleIds } from './vehicleSlice';
import { store } from 'app/store';
import type { RootState } from 'app/store';
import type { Vehicle } from 'types';
import { EntityType, entityKey } from 'types/EntityType';
import type { EditableValue } from 'types/EditableValue';
import {
  createOrUpdateEdit,
  clearEntityEdits,
  addEntityEdit,
  removeEntityAddition,
  addEntityDeletion,
  clearParentEdits,
} from 'edits/editActions';

const vehicleEntityKey = (id: string) => entityKey(EntityType.VEHICLE, id);
const orderEntityKey = (orderId: string) => entityKey(EntityType.ORDER, orderId);

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

export const editOrderVehicleAction = (
  vehicleId: string,
  path: string,
  originalValue: EditableValue,
  editedValue: EditableValue,
) => (dispatch: any) => {
  dispatch(createOrUpdateEdit({
    entityKey: vehicleEntityKey(vehicleId),
    path,
    originalValue,
    editedValue,
  }));
};

export const addOrderVehicleAction = (orderId: string, newVehicle: Vehicle) => (dispatch: any) => {
  dispatch(addEntityEdit({ parentKey: orderEntityKey(orderId), entity: newVehicle }));
};

export const deleteOrderVehicleAction = (orderId: string, vehicleId: string) => (dispatch: any, getState: () => RootState) => {
  const additions = getState().edits.additions[orderEntityKey(orderId)] ?? [];
  const isLocalAddition = additions.some((v: Vehicle) => v.id === vehicleId);

  if (isLocalAddition) {
    dispatch(removeEntityAddition({ parentKey: orderEntityKey(orderId), entityId: vehicleId }));
  } else {
    dispatch(addEntityDeletion({ parentKey: orderEntityKey(orderId), entityId: vehicleId }));
    dispatch(clearEntityEdits(vehicleEntityKey(vehicleId)));
  }
};

export const clearOrderVehiclesAction = (orderId: string) => (dispatch: any, getState: () => RootState) => {
  const { data: serverVehicles } = vehicleApi.endpoints.searchVehicles.select({ orderId })(getState());
  serverVehicles?.forEach(v => dispatch(clearEntityEdits(vehicleEntityKey(v.id))));
  dispatch(clearParentEdits(orderEntityKey(orderId)));
  invalidateBatchVehiclesResults(dispatch, orderId);
};
