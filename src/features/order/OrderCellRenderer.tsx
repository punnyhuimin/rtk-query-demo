import { useGetOrderByIdQuery, useUpsertOrderMutation, useDeleteOrderMutation } from './orderApi';
import {
  useSearchVehiclesQueryState,
  useDeleteOrderVehiclesMutation,
  useUpsertAndDeleteOrderVehiclesMutation,
} from 'features/vehicle/vehicleApi';
import { useInitialOrderVehicleIds } from 'features/vehicle/vehicleSlice';
import type { CustomCellRendererProps } from 'ag-grid-community';
import type { Order } from 'types';

const OrderCellRenderer = ({ data }: CustomCellRendererProps<Order>) => {
  const { data: order } = useGetOrderByIdQuery(data!.id);
  const { data: vehicles } = useSearchVehiclesQueryState({ orderId: data!.id });
  const initialVehicleIds = useInitialOrderVehicleIds(data!.id);

  const [upsertOrder] = useUpsertOrderMutation();
  const [deleteOrder] = useDeleteOrderMutation();
  const [deleteOrderVehicles] = useDeleteOrderVehiclesMutation();
  const [upsertAndDeleteOrderVehicles] = useUpsertAndDeleteOrderVehiclesMutation();

  const saveOrderHandler = async () => {
    try {
      const deletedIds = initialVehicleIds?.filter(id => !vehicles?.some(v => v.id === id)) ?? [];
      const editedVehicles = vehicles?.filter(v => v.__isDirty) ?? [];
      await Promise.all([
        upsertOrder(order!).unwrap(),
        upsertAndDeleteOrderVehicles({
          orderId: data!.id,
          upsertVehicles: editedVehicles,
          deleteIds: deletedIds,
        }).unwrap(),
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteOrderHandler = async () => {
    try {
      await Promise.all([
        deleteOrder(data!.id).unwrap(),
        deleteOrderVehicles(data!.id).unwrap(),
      ]);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <span>
      <button
        onClick={() => saveOrderHandler()}
        disabled={!order?.__isDirty || !vehicles}
      >
        Save
      </button>
      <button onClick={() => deleteOrderHandler()}>
        Delete
      </button>
    </span>
  );
};

export default OrderCellRenderer;
