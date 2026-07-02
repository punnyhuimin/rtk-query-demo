import { nanoid } from 'nanoid';
import type { Order, Item, Workspace } from 'types';

// Bump this when the data schema changes to force a localStorage reset.
const DATA_VERSION = '2';
if (localStorage.getItem('dataVersion') !== DATA_VERSION) {
  localStorage.removeItem('order');
  localStorage.removeItem('item');
  localStorage.removeItem('workspace');
  localStorage.setItem('dataVersion', DATA_VERSION);
}

const workspaces: Workspace[] = [
  { id: 'ws-1', name: 'Workspace A', isEditable: true },
  { id: 'ws-2', name: 'Workspace B', isEditable: true },
];

const orders: Order[] = [
  { id: nanoid(), name: 'order1', status: 'draft', workspaceId: 'ws-1' },
  { id: nanoid(), name: 'order2', status: 'draft', workspaceId: 'ws-1' },
  { id: nanoid(), name: 'order3', status: 'draft', workspaceId: 'ws-2' },
];

const items: Item[] = [
  { id: nanoid(), name: 'item1', _orderId: orders[1].id, warehouseCount: 0, warehouses: [] },
  { id: nanoid(), name: 'item2', _orderId: orders[1].id, warehouseCount: 0, warehouses: [] },
  { id: nanoid(), name: 'item3', _orderId: orders[2].id, warehouseCount: 0, warehouses: [] },
  { id: nanoid(), name: 'item4', _orderId: orders[2].id, warehouseCount: 0, warehouses: [] },
  { id: nanoid(), name: 'item5', _orderId: orders[2].id, warehouseCount: 0, warehouses: [] },
];

if (!localStorage.getItem('workspace')) {
  localStorage.setItem('workspace', JSON.stringify(workspaces));
}
if (!localStorage.getItem('order')) {
  localStorage.setItem('order', JSON.stringify(orders));
}
if (!localStorage.getItem('item')) {
  localStorage.setItem('item', JSON.stringify(items));
}

export const getWorkspaces = (): Workspace[] => JSON.parse(localStorage.getItem('workspace') ?? '[]');
export const saveWorkspaces = (ws: Workspace[]) => localStorage.setItem('workspace', JSON.stringify(ws));

export const getOrders = (): Order[] => JSON.parse(localStorage.getItem('order') ?? '[]');
export const saveOrders = (orders: Order[]) => localStorage.setItem('order', JSON.stringify(orders));

export const getItems = (): Item[] => JSON.parse(localStorage.getItem('item') ?? '[]');
export const saveItems = (items: Item[]) => localStorage.setItem('item', JSON.stringify(items));
