import { useDispatch, useSelector } from 'react-redux';
import type { CustomCellRendererProps } from 'ag-grid-community';

import { markEntityDeleted, removeLocalEntity } from 'edits/editSlice';
import { selectIsLocalEntity } from 'edits/editSelectors';
import { useSelectedItemId } from 'features/item/itemSlice';
import type { AppDispatch } from 'app/store';
import type { Warehouse } from 'types';

const WarehouseCellRenderer = ({ data }: CustomCellRendererProps<Warehouse>) => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedItemId = useSelectedItemId() ?? '';
  const isLocal = useSelector(selectIsLocalEntity('warehouse', data!.id));

  const deleteWarehouse = () => {
    if (isLocal) {
      dispatch(removeLocalEntity({ entityType: 'warehouse', entityId: data!.id }));
    } else {
      dispatch(markEntityDeleted({ entityType: 'warehouse', entityId: data!.id, parentId: selectedItemId }));
    }
  };

  return (
    <span>
      <button onClick={deleteWarehouse}>Delete</button>
    </span>
  );
};

export default WarehouseCellRenderer;
