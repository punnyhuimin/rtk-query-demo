import { nanoid } from 'nanoid';
import type { Order, Item } from 'types';

const orders: Order[] = [
  { id: nanoid(), name: 'order1' },
  { id: nanoid(), name: 'order2' },
  { id: nanoid(), name: 'order3' },
];

const items: Item[] = [
  {
    id: nanoid(), name: 'item1', _parentId: orders[1].id,
    warehouses: [
      { id: nanoid(), name: 'Sydney Hub',    location: 'Sydney' },
      { id: nanoid(), name: 'Melbourne Hub', location: 'Melbourne' },
    ],
  },
  {
    id: nanoid(), name: 'item2', _parentId: orders[1].id,
    warehouses: [
      { id: nanoid(), name: 'Brisbane Depot', location: 'Brisbane' },
    ],
  },
  {
    id: nanoid(), name: 'item3', _parentId: orders[2].id,
    warehouses: [
      { id: nanoid(), name: 'Perth Store', location: 'Perth' },
    ],
  },
  {
    id: nanoid(), name: 'item4', _parentId: orders[2].id,
    warehouses: [
      { id: nanoid(), name: 'Adelaide Centre', location: 'Adelaide' },
      { id: nanoid(), name: 'Darwin Outpost',  location: 'Darwin' },
    ],
  },
  {
    id: nanoid(), name: 'item5', _parentId: orders[2].id,
    warehouses: [
      { id: nanoid(), name: 'Hobart Facility', location: 'Hobart' },
    ],
  },
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
