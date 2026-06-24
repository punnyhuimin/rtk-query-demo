import { useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AgGridReact } from 'ag-grid-react';
import { nanoid } from '@reduxjs/toolkit';
import type { CellEditRequestEvent } from 'ag-grid-community';

import {
  useGetOrderVehiclesQuery,
  editOrderVehicleAction,
  addOrderVehicleAction,
  clearOrderVehiclesAction,
} from 'features/vehicle/vehicleApi';
import { useSelectedOrder } from 'features/order/orderSlice';
import { buildEntityView } from 'selectors/viewSelectors';
import { EntityType, entityKey } from 'types/EntityType';
import type { RootState } from 'app/store';
import VehicleCellRenderer from './VehicleCellRenderer';
import type { Vehicle } from 'types';

const columnDefs = [
  { field: 'id' },
  { field: 'name', editable: true, sortable: true },
  { headerName: 'Actions', cellRenderer: VehicleCellRenderer },
];

const rowSelection = {
  mode: 'multiRow',
  checkboxes: false,
  headerCheckbox: false,
  enableClickSelection: true,
};

const Vehicles = () => {
  const gridRef = useRef<AgGridReact<Vehicle>>(null);
  const dispatch = useDispatch();

  const { data: selectedOrder } = useSelectedOrder();
  const orderId = selectedOrder?.id;
  const { data: serverVehicles } = useGetOrderVehiclesQuery(orderId);

  const allEdits = useSelector((state: RootState) => state.edits);
  const vehicles = useMemo(() => {
    const orderKey = orderId ? entityKey(EntityType.ORDER, orderId) : undefined;
    const pendingDeleteIds: string[] = orderKey ? (allEdits.deletions[orderKey] ?? []) : [];
    const localAdditions: Vehicle[] = orderKey ? (allEdits.additions[orderKey] ?? []) : [];

    const serverWithEdits = (serverVehicles ?? [])
      .filter(v => !pendingDeleteIds.includes(v.id))
      .map(v => buildEntityView(v, allEdits.fields[entityKey(EntityType.VEHICLE, v.id)] ?? {}));

    return [...serverWithEdits, ...localAdditions];
  }, [serverVehicles, allEdits, orderId]);

  const onCellEditRequest = useCallback((event: CellEditRequestEvent<Vehicle>) => {
    const { data, colDef: { field }, oldValue, newValue } = event;
    dispatch(editOrderVehicleAction(data!.id, field!, oldValue, newValue));
  }, [dispatch]);

  const addOrderVehicle = useCallback(() => {
    const newVehicle: Vehicle = { id: nanoid(), name: 'new vehicle', _orderId: selectedOrder!.id, engines: [] };
    dispatch(addOrderVehicleAction(selectedOrder!.id, newVehicle));
  }, [dispatch, selectedOrder]);

  const clearVehicles = useCallback(() => {
    if (orderId) dispatch(clearOrderVehiclesAction(orderId));
  }, [dispatch, orderId]);

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '4px' }}>
          <button onClick={() => addOrderVehicle()} disabled={!selectedOrder}>Add Vehicle</button>
          <button onClick={clearVehicles}>Clear Data</button>
        </div>
        <div className="ag-theme-alpine" style={{ flexGrow: '1' }}>
          <AgGridReact<Vehicle>
            ref={gridRef}
            getRowId={(params) => params.data.id}
            rowData={vehicles}
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

export default Vehicles;
