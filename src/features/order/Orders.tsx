import { nanoid } from '@reduxjs/toolkit';
import { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AgGridReact } from 'ag-grid-react';
import type { CellEditRequestEvent } from 'ag-grid-community';

import { useGetOrdersQuery, updateOrderAction, useUpsertOrderMutation } from 'features/order/orderApi';
import { itemApi } from 'features/item/itemApi';
import { getEditedRowItem } from 'app/GridUtils';
import { selectOrderId, clearSelectedOrderId } from './orderSlice';
import { useAppSelector } from 'app/hooks';
import { selectSelectedWorkspaceId } from 'features/workspace/workspaceSlice';
import OrderCellRenderer from './OrderCellRenderer';
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
  const dispatch = useDispatch();
  const selectedWorkspaceId = useAppSelector(selectSelectedWorkspaceId);
  const { data } = useGetOrdersQuery(selectedWorkspaceId ?? '', { skip: !selectedWorkspaceId });
  const [upsertOrder] = useUpsertOrderMutation();

  const onCellEditRequest = useCallback((event: CellEditRequestEvent<Order>) => {
    const editedOrder = getEditedRowItem(event);
    dispatch(updateOrderAction(editedOrder.workspaceId, editedOrder.id, editedOrder));
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
    if (!selectedWorkspaceId) return;
    const newOrder: Order = { id: nanoid(), name: 'new order', status: 'draft', workspaceId: selectedWorkspaceId };
    try {
      await upsertOrder(newOrder).unwrap();
    } catch (e) {
      console.error(e);
    }
  }, [upsertOrder, selectedWorkspaceId]);

  const test = () => {
    dispatch(itemApi.endpoints.searchItemsBatch.initiate({ orderIds: ['ri6CHMGrjxpxN4dkO0g24', 'bq9oe9MrLaNA5PSgqTC8h'] }));
  };

  return (
    <div style={{ height: '200px', width: '100%' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '4px' }}>
          <button onClick={() => addOrderHandler()} disabled={!selectedWorkspaceId}>Add Order</button>
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
