import type { CustomCellRendererProps } from 'ag-grid-community';

import { useAppDispatch } from 'app/hooks';
import { deleteOrderItemAction } from 'features/item/itemApi';
import { useSelectedOrder } from 'features/order/orderSlice';
import type { Item } from 'types';

const ItemCellRenderer = ({ data }: CustomCellRendererProps<Item>) => {
  const dispatch = useAppDispatch();
  const { data: selectedOrder } = useSelectedOrder();
  const deleteItem = () => {
    dispatch(deleteOrderItemAction(selectedOrder!.workspaceId, data!._orderId, data!.id));
  };

  return (
    <span>
      <button onClick={() => deleteItem()}>Delete</button>
    </span>
  );
};

export default ItemCellRenderer;
