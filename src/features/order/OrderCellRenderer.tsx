import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetOrderByIdQuery, useUpsertOrderMutation, useDeleteOrderMutation } from './orderApi';
import {
  useSearchVehiclesQueryState,
  useDeleteOrderVehiclesMutation,
  useUpsertAndDeleteOrderVehiclesMutation,
} from 'features/vehicle/vehicleApi';
import { buildEntityView, selectEntityIsDirty } from 'selectors/viewSelectors';
import { selectEntityConflicts } from 'selectors/conflictSelectors';
import { clearEntityEdits, clearParentEdits } from 'edits/editActions';
import { EntityType, entityKey } from 'types/EntityType';
import type { RootState } from 'app/store';
import type { CustomCellRendererProps } from 'ag-grid-community';
import type { Order, Vehicle } from 'types';

const OrderCellRenderer = ({ data }: CustomCellRendererProps<Order>) => {
  const dispatch = useDispatch();
  const { data: serverOrder } = useGetOrderByIdQuery(data!.id);
  const { data: serverVehicles } = useSearchVehiclesQueryState({ orderId: data!.id });
  const allEdits = useSelector((state: RootState) => state.edits);

  const [upsertOrder] = useUpsertOrderMutation();
  const [deleteOrder] = useDeleteOrderMutation();
  const [deleteOrderVehicles] = useDeleteOrderVehiclesMutation();
  const [upsertAndDeleteOrderVehicles] = useUpsertAndDeleteOrderVehiclesMutation();

  const orderId = data!.id;
  const orderKey = entityKey(EntityType.ORDER, orderId);
  const orderParentKey = entityKey(EntityType.ORDER, orderId);

  const orderView = useMemo(
    () => serverOrder && buildEntityView(serverOrder, allEdits.fields[orderKey] ?? {}),
    [serverOrder, allEdits, orderKey],
  );

  const isDirty = useSelector((state: RootState) => {
    const hasOrderFieldEdits = selectEntityIsDirty(state, orderKey);
    const hasVehicleFieldEdits = serverVehicles?.some(v =>
      selectEntityIsDirty(state, entityKey(EntityType.VEHICLE, v.id))
    ) ?? false;
    const hasAdditions = (state.edits.additions[orderParentKey]?.length ?? 0) > 0;
    const hasDeletions = (state.edits.deletions[orderParentKey]?.length ?? 0) > 0;
    return hasOrderFieldEdits || hasVehicleFieldEdits || hasAdditions || hasDeletions;
  });

  const conflicts = useSelector((state: RootState) =>
    serverVehicles?.flatMap(v =>
      selectEntityConflicts(state, entityKey(EntityType.VEHICLE, v.id), v)
    ) ?? []
  );

  const saveOrderHandler = async () => {
    try {
      const pendingDeleteIds = allEdits.deletions[orderParentKey] ?? [];
      const localAdditions: Vehicle[] = allEdits.additions[orderParentKey] ?? [];

      const fieldEditedVehicles = serverVehicles?.reduce<Vehicle[]>((acc, v) => {
        const key = entityKey(EntityType.VEHICLE, v.id);
        const vehicleEdits = allEdits.fields[key];
        if (vehicleEdits && Object.keys(vehicleEdits).length > 0) {
          acc.push(buildEntityView(v, vehicleEdits));
        }
        return acc;
      }, []) ?? [];

      const upsertVehicles = [...fieldEditedVehicles, ...localAdditions];

      await Promise.all([
        upsertOrder(orderView!).unwrap(),
        upsertAndDeleteOrderVehicles({
          orderId,
          upsertVehicles,
          deleteIds: pendingDeleteIds,
        }).unwrap(),
      ]);

      dispatch(clearEntityEdits(orderKey));
      fieldEditedVehicles.forEach(v => dispatch(clearEntityEdits(entityKey(EntityType.VEHICLE, v.id))));
      dispatch(clearParentEdits(orderParentKey));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteOrderHandler = async () => {
    try {
      await Promise.all([
        deleteOrder(orderId).unwrap(),
        deleteOrderVehicles(orderId).unwrap(),
      ]);
      dispatch(clearEntityEdits(orderKey));
      dispatch(clearParentEdits(orderParentKey));
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <span>
      <button
        onClick={() => saveOrderHandler()}
        disabled={!isDirty}
        title={conflicts.length > 0 ? `${conflicts.length} conflict(s) detected` : undefined}
      >
        {conflicts.length > 0 ? 'Save (!)' : 'Save'}
      </button>
      <button onClick={() => deleteOrderHandler()}>
        Delete
      </button>
    </span>
  );
};

export default OrderCellRenderer;
