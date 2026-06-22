import { useDispatch } from 'react-redux';
import type { CustomCellRendererProps } from 'ag-grid-community';

import { deleteOrderItemAction } from 'features/item/itemApi';
import type { Item } from 'types';

const ItemCellRenderer = ({ data }: CustomCellRendererProps<Item>) => {
  const dispatch = useDispatch();
  const deleteItem = () => {
    dispatch(deleteOrderItemAction(data!._orderId, data!.id));
  };

  return (
    <span>
      <button onClick={() => deleteItem()}>Delete</button>
    </span>
  );
};

export default ItemCellRenderer;
