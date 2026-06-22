import orderHandlers from './services/order';
import itemHandlers from './services/item';

export const handlers = [
  ...orderHandlers,
  ...itemHandlers,
];
