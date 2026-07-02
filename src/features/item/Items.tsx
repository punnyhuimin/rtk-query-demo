import { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AgGridReact } from 'ag-grid-react';
import { nanoid } from '@reduxjs/toolkit';
import type { CellEditRequestEvent } from 'ag-grid-community';

import {
  useGetOrderItemsQuery,
  editOrderItemAction,
  addOrderItemAction,
  clearOrderItemsAction,
} from 'features/item/itemApi';
import { useSelectedOrder } from 'features/order/orderSlice';
import { getEditedRowItem } from 'app/GridUtils';
import ItemCellRenderer from './ItemCellRenderer';
import type { Item } from 'types';

const columnDefs = [
  { field: 'id' },
  { field: 'name', editable: true, sortable: true },
  { headerName: 'Actions', cellRenderer: ItemCellRenderer },
];

const rowSelection = {
  mode: 'multiRow',
  checkboxes: false,
  headerCheckbox: false,
  enableClickSelection: true,
};

const Items = () => {
  const gridRef = useRef<AgGridReact<Item>>(null);
  const dispatch = useDispatch();

  const { data: selectedOrder } = useSelectedOrder();
  const { data: items } = useGetOrderItemsQuery(selectedOrder?.id);

  const onCellEditRequest = useCallback((event: CellEditRequestEvent<Item>) => {
    const editedItem = getEditedRowItem(event);
    dispatch(editOrderItemAction(selectedOrder!.workspaceId, selectedOrder!.id, editedItem));
  }, [dispatch, selectedOrder]);

  const addOrderItem = useCallback(() => {
    const newItem: Item = { id: nanoid(), name: 'new item', _orderId: selectedOrder!.id, warehouseCount: 0, warehouses: [] };
    dispatch(addOrderItemAction(selectedOrder!.workspaceId, selectedOrder!.id, newItem));
  }, [dispatch, selectedOrder]);

  const clearItems = useCallback(() => {
    dispatch(clearOrderItemsAction(selectedOrder!.workspaceId, selectedOrder!.id));
  }, [dispatch, selectedOrder]);

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
            rowData={items}
            columnDefs={columnDefs}
            animateRows={true}
            readOnlyEdit={true}
            onCellEditRequest={onCellEditRequest}
            rowSelection={rowSelection}
          />
        </div>
      </div>
    </div>
  );
};

export default Items;
