import { http, HttpResponse, delay } from 'msw';
import { nanoid } from '@reduxjs/toolkit';

import { getItems, saveItems } from 'mocks/data';
import { merge } from './utils';
import type { Item } from 'types';

let items = getItems();

const groupedByOrderId = (items: Item[]) => items.reduce<Record<string, Item[]>>((acc, item) => {
  const orderId = item._parentId;
  if (!acc[orderId]) {
    acc[orderId] = [];
  }
  acc[orderId].push(item);
  return acc;
}, {});

const missionHandlers = [
  http.get('/api/v1/item', async () => {
    await delay();
    return HttpResponse.json(items);
  }),
  http.put('/api/v1/item', async ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    const body = await request.json() as Item | Item[] | null;
    if (!body || !orderId) {
      return new HttpResponse(null, {
        status: 400,
        statusText: 'No data',
      });
    }
    const newItems = (Array.isArray(body) ? body : [body])
      .map(({ id = nanoid(), name, warehouses = [] }) => ({ id, name, _parentId: orderId, warehouses }));
    items = merge(items, newItems, (a, b) => a.id === b.id);
    saveItems(items);
    await delay();
    return HttpResponse.json(newItems);
  }),
  http.post('/api/v1/searchItems', async ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    if (orderId) {
      const result = items.filter(i => i._parentId === orderId);
      return HttpResponse.json(result);
    }

    const body = await request.json() as { orderIds?: string[]; itemIds?: string[] } | null;
    const { orderIds = [], itemIds = [] } = body ?? {};
    const result = orderIds.length
      ? groupedByOrderId(items.filter(i => orderIds.includes(i._parentId)))
      : items.filter(i => itemIds.includes(i.id));
    await delay();
    return HttpResponse.json(result);
  }),
  http.delete('/api/v1/item', async ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    let body = await request.text();
    if (!body && !orderId) {
      return new HttpResponse(null, {
        status: 400,
        statusText: 'orderId param or itemIds required',
      });
    }

    const originalCount = items.length;
    if (orderId) {
      items = items.filter(i => i._parentId !== orderId);
    } else {
      const parsed = JSON.parse(body) as string | string[];
      const idsToDelete = Array.isArray(parsed) ? parsed : [parsed];
      items = items.filter(i => !idsToDelete.some(id => id === i.id));
    }

    saveItems(items);
    await delay();
    return HttpResponse.json({ deleteCount: originalCount - items.length });
  }),
];

export default missionHandlers;
