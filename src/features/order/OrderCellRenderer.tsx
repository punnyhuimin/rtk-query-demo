import { useDispatch, useSelector } from 'react-redux';
import {
  useUpsertOrderMutation,
  useDeleteOrderMutation,
} from './orderApi';
import {
  useSearchItemsQueryState,
  useDeleteOrderItemsMutation,
  useUpsertAndDeleteOrderItemsMutation,
} from 'features/item/itemApi';
import { clearOrderAllEditsThunk } from 'edits/editActions';
import { selectOrderHasLocalChanges } from 'edits/editSelectors';
import { selectOrderView, selectOrderUpsertItems } from 'edits/viewSelectors';
import { selectDeletedEntityIdsOfType } from 'edits/editSelectors';
import type { CustomCellRendererProps } from 'ag-grid-community';
import type { AppDispatch } from 'app/store';
import type { Order } from 'types';

const OrderCellRenderer = ({ data }: CustomCellRendererProps<Order>) => {
  const dispatch = useDispatch<AppDispatch>();
  const orderId = data!.id;

  const orderView = useSelector(selectOrderView(orderId));
  const hasLocalChanges = useSelector(selectOrderHasLocalChanges(orderId));
  const upsertItems = useSelector(selectOrderUpsertItems(orderId));
  const deletedIds = useSelector(selectDeletedEntityIdsOfType('item', orderId));
  const { data: serverItems } = useSearchItemsQueryState({ orderId });

  const [upsertOrder] = useUpsertOrderMutation();
  const [deleteOrder] = useDeleteOrderMutation();
  const [deleteOrderItems] = useDeleteOrderItemsMutation();
  const [upsertAndDeleteOrderItems] = useUpsertAndDeleteOrderItemsMutation();

  const saveOrderHandler = async () => {
    try {
      await Promise.all([
        upsertOrder(orderView!).unwrap(),
        upsertAndDeleteOrderItems({
          orderId,
          upsertItems,
          deleteIds: deletedIds,
        }).unwrap(),
      ]);
      dispatch(clearOrderAllEditsThunk(orderId));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteOrderHandler = async () => {
    try {
      await Promise.all([
        deleteOrder(orderId).unwrap(),
        deleteOrderItems(orderId).unwrap(),
      ]);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <span>
      <button
        onClick={() => saveOrderHandler()}
        disabled={!hasLocalChanges || !serverItems}
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
