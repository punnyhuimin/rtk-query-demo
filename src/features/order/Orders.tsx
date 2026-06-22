import { nanoid } from '@reduxjs/toolkit';
import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AgGridReact } from 'ag-grid-react';
import type { CellEditRequestEvent } from 'ag-grid-community';

import { useGetOrdersQuery, useUpsertOrderMutation } from 'features/order/orderApi';
import { itemApi } from 'features/item/itemApi';
import { upsertPropertyEdit } from 'edits/editSlice';
import { selectOrdersView } from 'edits/viewSelectors';
import { selectOrderId, clearSelectedOrderId } from './orderSlice';
import OrderCellRenderer from './OrderCellRenderer';
import type { AppDispatch } from 'app/store';
import type { Order } from 'types';

const columnDefs = [
  { field: 'id' },
  { field: 'name', editable: true, sortable: true },
  { field: 'itemsCount', sortable: true },
  { headerName: 'Save', cellRenderer: OrderCellRenderer },
];

const rowSelection = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
};

const Orders = () => {
  const gridRef = useRef<AgGridReact<Order>>(null);
  const dispatch = useDispatch<AppDispatch>();

  useGetOrdersQuery(); // trigger fetch; view is derived by selector
  const ordersView = useSelector(selectOrdersView);

  const [upsertOrder] = useUpsertOrderMutation();

  const onCellEditRequest = useCallback((event: CellEditRequestEvent<Order>) => {
    const { data, colDef: { field }, newValue } = event;
    dispatch(upsertPropertyEdit({
      entityId: data!.id,
      path: field!,
      originalValue: (data as unknown as Record<string, unknown>)[field!],
      editedValue: newValue,
    }));
  }, [dispatch]);

  const onSelectionChanged = useCallback(() => {
    const [selectedOrder] = gridRef.current!.api.getSelectedRows();
    if (selectedOrder) {
      dispatch(selectOrderId(selectedOrder.id));
    } else {
      dispatch(clearSelectedOrderId());
    }
  }, [dispatch]);

  const addOrderHandler = useCallback(async () => {
    const newOrder: Order = { id: nanoid(), name: 'new order' };
    try {
      await upsertOrder(newOrder).unwrap();
    } catch (e) {
      console.error(e);
    }
  }, [upsertOrder]);

  const test = () => {
    dispatch(itemApi.endpoints.searchItemsBatch.initiate({ orderIds: ['ri6CHMGrjxpxN4dkO0g24', 'bq9oe9MrLaNA5PSgqTC8h'] }));
  };

  return (
    <div style={{ height: '200px', width: '100%' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '4px' }}>
          <button onClick={() => addOrderHandler()}>Add Order</button>
          <button onClick={() => test()}>Test Batch</button>
        </div>
        <div className="ag-theme-alpine" style={{ height: '100%' }}>
          <AgGridReact<Order>
            ref={gridRef}
            getRowId={(params) => params.data.id}
            rowData={ordersView}
            columnDefs={columnDefs}
            readOnlyEdit={true}
            onCellEditRequest={onCellEditRequest}
            rowSelection={rowSelection}
            onSelectionChanged={onSelectionChanged}
            editType={'fullRow'}
          />
        </div>
      </div>
    </div>
  );
};

export default Orders;
