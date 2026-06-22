import { nanoid } from 'nanoid';
import type { Order, Item } from 'types';

const orders: Order[] = [
  { id: nanoid(), name: 'order1' },
  { id: nanoid(), name: 'order2' },
  { id: nanoid(), name: 'order3' },
];

const items: Item[] = [
  { id: nanoid(), name: 'item1', _orderId: orders[1].id },
  { id: nanoid(), name: 'item2', _orderId: orders[1].id },
  { id: nanoid(), name: 'item3', _orderId: orders[2].id },
  { id: nanoid(), name: 'item4', _orderId: orders[2].id },
  { id: nanoid(), name: 'item5', _orderId: orders[2].id },
];

export const saveOrders = (orders: Order[]) => localStorage.setItem('order', JSON.stringify(orders));
export const saveItems = (items: Item[]) => localStorage.setItem('item', JSON.stringify(items));

if (!localStorage.getItem('order')) {
  localStorage.setItem('order', JSON.stringify(orders));
}

if (!localStorage.getItem('item')) {
  localStorage.setItem('item', JSON.stringify(items));
}

export const getOrders = (): Order[] => JSON.parse(localStorage.getItem('order') ?? '[]');
export const getItems = (): Item[] => JSON.parse(localStorage.getItem('item') ?? '[]');
