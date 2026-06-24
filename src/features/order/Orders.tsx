import { nanoid } from '@reduxjs/toolkit';
import { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AgGridReact } from 'ag-grid-react';
import type { CellEditRequestEvent } from 'ag-grid-community';

import { useGetOrdersQuery, updateOrderAction, useUpsertOrderMutation } from 'features/order/orderApi';
import { vehicleApi } from 'features/vehicle/vehicleApi';
import { getEditedRowItem } from 'app/GridUtils';
import { selectOrderId, clearSelectedOrderId } from './orderSlice';
import OrderCellRenderer from './OrderCellRenderer';
import type { Order } from 'types';

const columnDefs = [
  { field: 'id' },
  { field: 'name', editable: true, sortable: true },
  { field: 'vehicleCount', sortable: true },
  { headerName: 'Save', cellRenderer: OrderCellRenderer },
];

const rowSelection = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
};

const Orders = () => {
  const gridRef = useRef<AgGridReact<Order>>(null);
  const dispatch = useDispatch();
  const { data } = useGetOrdersQuery();
  const [upsertOrder] = useUpsertOrderMutation();

  const onCellEditRequest = useCallback((event: CellEditRequestEvent<Order>) => {
    const editedOrder = getEditedRowItem(event);
    dispatch(updateOrderAction(editedOrder.id, editedOrder));
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
    dispatch(vehicleApi.endpoints.searchVehiclesBatch.initiate({ orderIds: ['ri6CHMGrjxpxN4dkO0g24', 'bq9oe9MrLaNA5PSgqTC8h'] }));
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
            rowData={data}
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
