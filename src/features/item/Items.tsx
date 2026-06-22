import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AgGridReact } from 'ag-grid-react';
import { nanoid } from '@reduxjs/toolkit';
import type { CellEditRequestEvent } from 'ag-grid-community';

import { useGetOrderItemsQuery } from 'features/item/itemApi';
import { useSelectedOrder } from 'features/order/orderSlice';
import { selectItemId, clearSelectedItemId } from 'features/item/itemSlice';
import { upsertPropertyEdit, addLocalEntity, updateLocalEntity } from 'edits/editSlice';
import { clearOrderItemsThunk } from 'edits/editActions';
import { selectOrderItemsView } from 'edits/viewSelectors';
import ItemCellRenderer from './ItemCellRenderer';
import type { AppDispatch, RootState } from 'app/store';
import type { Item } from 'types';

const columnDefs = [
  { field: 'id' },
  { field: 'name', editable: true, sortable: true },
  { headerName: 'Actions', cellRenderer: ItemCellRenderer },
];

const rowSelection = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
};

const Items = () => {
  const gridRef = useRef<AgGridReact<Item>>(null);
  const dispatch = useDispatch<AppDispatch>();

  const { data: selectedOrder } = useSelectedOrder();
  const orderId = selectedOrder?.id ?? '';

  useGetOrderItemsQuery(selectedOrder?.id); // trigger fetch; view is derived by selector
  const itemsView = useSelector(selectOrderItemsView(orderId));
  const addedItemIds = useSelector((state: RootState) => state.edits.addedEntities['item'] ?? {});

  const onCellEditRequest = useCallback((event: CellEditRequestEvent<Item>) => {
    const { data, colDef: { field }, newValue } = event;
    if (data!.id in addedItemIds) {
      dispatch(updateLocalEntity({ entityType: 'item', entity: { ...data!, [field!]: newValue } }));
    } else {
      dispatch(upsertPropertyEdit({
        entityId: data!.id,
        path: field!,
        originalValue: (data as unknown as Record<string, unknown>)[field!],
        editedValue: newValue,
      }));
    }
  }, [dispatch, addedItemIds]);

  const onSelectionChanged = useCallback(() => {
    const [selectedItem] = gridRef.current!.api.getSelectedRows();
    if (selectedItem) {
      dispatch(selectItemId(selectedItem.id));
    } else {
      dispatch(clearSelectedItemId());
    }
  }, [dispatch]);

  const addOrderItem = useCallback(() => {
    const newItem: Item = { id: nanoid(), name: 'new item', _parentId: orderId };
    dispatch(addLocalEntity({ entityType: 'item', entity: newItem }));
  }, [dispatch, orderId]);

  const clearItems = useCallback(() => {
    dispatch(clearOrderItemsThunk(orderId));
  }, [dispatch, orderId]);

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '4px' }}>
          <button onClick={() => addOrderItem()} disabled={!selectedOrder}>Add Item</button>
          <button onClick={clearItems}>Clear Data</button>
        </div>
        <div className="ag-theme-alpine" style={{ flexGrow: '1' }}>
          <AgGridReact<Item>
            ref={gridRef}
            getRowId={(params) => params.data.id}
            rowData={itemsView}
            columnDefs={columnDefs}
            animateRows={true}
            readOnlyEdit={true}
            onCellEditRequest={onCellEditRequest}
            onSelectionChanged={onSelectionChanged}
            rowSelection={rowSelection}
          />
        </div>
      </div>
    </div>
  );
};

export default Items;
