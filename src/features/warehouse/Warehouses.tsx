import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AgGridReact } from 'ag-grid-react';
import { nanoid } from '@reduxjs/toolkit';
import type { CellEditRequestEvent } from 'ag-grid-community';

import { useSelectedItemId } from 'features/item/itemSlice';
import { useSelectedOrder } from 'features/order/orderSlice';
import { upsertPropertyEdit, addLocalEntity, updateLocalEntity } from 'edits/editSlice';
import { selectItemWarehousesView } from 'edits/viewSelectors';
import WarehouseCellRenderer from './WarehouseCellRenderer';
import type { AppDispatch, RootState } from 'app/store';
import type { Warehouse } from 'types';

const columnDefs = [
  { field: 'id' },
  { field: 'name', editable: true, sortable: true },
  { field: 'location', editable: true, sortable: true },
  { headerName: 'Actions', cellRenderer: WarehouseCellRenderer },
];

const Warehouses = () => {
  const gridRef = useRef<AgGridReact<Warehouse>>(null);
  const dispatch = useDispatch<AppDispatch>();

  const selectedItemId = useSelectedItemId();
  const { data: selectedOrder } = useSelectedOrder();
  const orderId = selectedOrder?.id ?? '';

  const warehousesView = useSelector(selectItemWarehousesView(selectedItemId ?? '', orderId));
  const addedWarehouseIds = useSelector(
    (state: RootState) => state.edits.addedEntities['warehouse'] ?? {}
  );

  const onCellEditRequest = useCallback((event: CellEditRequestEvent<Warehouse>) => {
    if (!selectedItemId) return;
    const { data, colDef: { field }, newValue } = event;
    if (data!.id in addedWarehouseIds) {
      dispatch(updateLocalEntity({
        entityType: 'warehouse',
        // data at runtime includes _parentId since it came from addedEntities
        entity: { ...(data as any), [field!]: newValue },
      }));
    } else {
      dispatch(upsertPropertyEdit({
        entityId: selectedItemId,
        path: `warehouses[id=${data!.id}].${field!}`,
        originalValue: (data as unknown as Record<string, unknown>)[field!],
        editedValue: newValue,
      }));
    }
  }, [dispatch, selectedItemId, addedWarehouseIds]);

  const addWarehouse = useCallback(() => {
    if (!selectedItemId) return;
    dispatch(addLocalEntity({
      entityType: 'warehouse',
      entity: { id: nanoid(), name: 'new warehouse', location: '', _parentId: selectedItemId },
    }));
  }, [dispatch, selectedItemId]);

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '4px' }}>
          <button onClick={addWarehouse} disabled={!selectedItemId}>Add Warehouse</button>
        </div>
        <div className="ag-theme-alpine" style={{ flexGrow: '1' }}>
          <AgGridReact<Warehouse>
            ref={gridRef}
            getRowId={(params) => params.data.id}
            rowData={warehousesView}
            columnDefs={columnDefs}
            animateRows={true}
            readOnlyEdit={true}
            onCellEditRequest={onCellEditRequest}
          />
        </div>
      </div>
    </div>
  );
};

export default Warehouses;
