import orderHandlers from './services/order';
import itemHandlers from './services/item';
import workspaceHandlers from './services/workspace';

export const handlers = [
  ...workspaceHandlers,
  ...orderHandlers,
  ...itemHandlers,
];
