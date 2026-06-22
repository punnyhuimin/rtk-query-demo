import { useDispatch, useSelector } from 'react-redux';
import type { CustomCellRendererProps } from 'ag-grid-community';

import { markEntityDeleted, removeLocalEntity } from 'edits/editSlice';
import { selectIsLocalEntity } from 'edits/editSelectors';
import type { AppDispatch } from 'app/store';
import type { Item } from 'types';

const ItemCellRenderer = ({ data }: CustomCellRendererProps<Item>) => {
  const dispatch = useDispatch<AppDispatch>();
  const isLocal = useSelector(selectIsLocalEntity('item', data!.id));

  const deleteItem = () => {
    if (isLocal) {
      dispatch(removeLocalEntity({ entityType: 'item', entityId: data!.id }));
    } else {
      dispatch(markEntityDeleted({ entityType: 'item', entityId: data!.id, parentId: data!._parentId }));
    }
  };

  return (
    <span>
      <button onClick={() => deleteItem()}>Delete</button>
    </span>
  );
};

export default ItemCellRenderer;
