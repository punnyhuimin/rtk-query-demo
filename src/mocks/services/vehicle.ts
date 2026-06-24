import { http, HttpResponse, delay } from 'msw';
import { nanoid } from '@reduxjs/toolkit';

import { getVehicles, saveVehicles } from 'mocks/data';
import { merge } from './utils';
import type { Vehicle } from 'types';


const groupedByOrderId = (vehicles: Vehicle[]) => vehicles.reduce<Record<string, Vehicle[]>>((acc, vehicle) => {
  const orderId = vehicle._orderId;
  if (!acc[orderId]) {
    acc[orderId] = [];
  }
  acc[orderId].push(vehicle);
  return acc;
}, {});

let vehicles = getVehicles();
const vehicleHandlers = [
  http.get('/api/v1/vehicle', async () => {
    await delay();
    return HttpResponse.json(vehicles);
  }),
  http.put('/api/v1/vehicle', async ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    const body = await request.json() as Vehicle | Vehicle[] | null;
    if (!body || !orderId) {
      return new HttpResponse(null, {
        status: 400,
        statusText: 'No data',
      });
    }
    const newItems = (Array.isArray(body) ? body : [body])
      .map(({ id = nanoid(), name }) => ({ id, name, _orderId: orderId, engines: [] }));
    vehicles = merge(vehicles, newItems, (a, b) => a.id === b.id);
    saveVehicles(vehicles);
    await delay();
    return HttpResponse.json(newItems);
  }),
  http.post('/api/v1/searchVehicles', async ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    if (orderId) {
      const result = vehicles.filter(i => i._orderId === orderId);
      return HttpResponse.json(result);
    }

    const body = await request.json() as { orderIds?: string[]; itemIds?: string[] } | null;
    const { orderIds = [], itemIds = [] } = body ?? {};
    const result = orderIds.length
      ? groupedByOrderId(vehicles.filter(i => orderIds.includes(i._orderId)))
      : vehicles.filter(i => itemIds.includes(i.id));
    await delay();
    return HttpResponse.json(result);
  }),
  http.delete('/api/v1/vehicle', async ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    let body = await request.text();
    if (!body && !orderId) {
      return new HttpResponse(null, {
        status: 400,
        statusText: 'orderId param or itemIds required',
      });
    }

    const originalCount = vehicles.length;
    if (orderId) {
      vehicles = vehicles.filter(i => i._orderId !== orderId);
    } else {
      const parsed = JSON.parse(body) as string | string[];
      const idsToDelete = Array.isArray(parsed) ? parsed : [parsed];
      vehicles = vehicles.filter(i => !idsToDelete.some(id => id === i.id));
    }

    saveVehicles(vehicles);
    await delay();
    return HttpResponse.json({ deleteCount: originalCount - vehicles.length });
  }),
];

export default vehicleHandlers;
