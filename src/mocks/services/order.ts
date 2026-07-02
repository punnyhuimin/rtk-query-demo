import { nanoid } from '@reduxjs/toolkit';
import { http, HttpResponse, delay } from 'msw';

import { getOrders, saveOrders } from 'mocks/data';
import { merge } from './utils';
import type { Order } from 'types';

let orders = getOrders();

const orderHandlers = [
  http.get('/api/v1/order', async ({ request }) => {
    const workspaceId = new URL(request.url).searchParams.get('workspaceId');
    const result = workspaceId ? orders.filter(o => o.workspaceId === workspaceId) : orders;
    await delay();
    return HttpResponse.json(result);
  }),
  http.get('/api/v1/order/:id', async ({ params }) => {
    const id = params.id as string;
    const item = orders.find(p => p.id === id);
    await delay();
    return item ? HttpResponse.json(item) : new HttpResponse(null, {
      status: 404,
      statusText: 'Order not found',
    });
  }),
  http.put('/api/v1/order', async ({ request }) => {
    const body = await request.json() as Partial<Order> | null;
    if (!body) {
      return new HttpResponse(null, {
        status: 400,
        statusText: 'No data',
      });
    }
    const { id = nanoid(), name, status, workspaceId, isEditable } = body;
    const order: Order = { id, name: name ?? '', status: status ?? 'draft', workspaceId: workspaceId ?? '', isEditable };

    orders = merge(orders, [order], (a, b) => a.id === b.id);
    await delay();
    saveOrders(orders);
    return HttpResponse.json(order, { status: 201 });
  }),
  http.delete('/api/v1/order/:id', async ({ params }) => {
    const id = params.id as string;
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    const [deletedOrder] = orders.splice(index, 1);
    saveOrders(orders);
    await delay();
    return HttpResponse.json(deletedOrder);
  }),
];

export default orderHandlers;
