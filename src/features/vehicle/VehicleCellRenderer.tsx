import { useDispatch } from 'react-redux';
import type { CustomCellRendererProps } from 'ag-grid-community';

import { deleteOrderVehicleAction } from 'features/vehicle/vehicleApi';
import type { Vehicle } from 'types';

const VehicleCellRenderer = ({ data }: CustomCellRendererProps<Vehicle>) => {
  const dispatch = useDispatch();
  const deleteVehicle = () => {
    dispatch(deleteOrderVehicleAction(data!._orderId, data!.id));
  };

  return (
    <span>
      <button onClick={() => deleteVehicle()}>Delete</button>
    </span>
  );
};

export default VehicleCellRenderer;
