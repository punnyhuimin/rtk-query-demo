import orderHandlers from './services/order';
import vehicleHandlers from './services/vehicle';

export const handlers = [
  ...orderHandlers,
  ...vehicleHandlers,
];
