import { nanoid } from 'nanoid';
import type { Order, Vehicle } from 'types';

const orders: Order[] = [
  { id: nanoid(), name: 'order1' },
  { id: nanoid(), name: 'order2' },
  { id: nanoid(), name: 'order3' },
];

const vehicles: Vehicle[] = [
  { id: nanoid(), name: 'vehicle1', _orderId: orders[1].id, engines: [] },
  { id: nanoid(), name: 'vehicle2', _orderId: orders[1].id, engines: [] },
  { id: nanoid(), name: 'vehicle3', _orderId: orders[2].id, engines: [] },
  { id: nanoid(), name: 'vehicle4', _orderId: orders[2].id, engines: [] },
  { id: nanoid(), name: 'vehicle5', _orderId: orders[2].id, engines: [] },
];

export const saveOrders = (orders: Order[]) => localStorage.setItem('order', JSON.stringify(orders));
export const saveVehicles = (vehicles: Vehicle[]) => localStorage.setItem('vehicle', JSON.stringify(vehicles));

if (!localStorage.getItem('order')) {
  localStorage.setItem('order', JSON.stringify(orders));
}

if (!localStorage.getItem('vehicle')) {
  localStorage.setItem('vehicle', JSON.stringify(vehicles));
}

export const getOrders = (): Order[] => JSON.parse(localStorage.getItem('order') ?? '[]');
export const getVehicles = (): Vehicle[] => JSON.parse(localStorage.getItem('vehicle') ?? '[]');
