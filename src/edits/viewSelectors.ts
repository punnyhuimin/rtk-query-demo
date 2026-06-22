import type { RootState } from 'app/store';
import { orderApi } from 'features/order/orderApi';
import { itemApi } from 'features/item/itemApi';
import { applyPatches } from 'patches/applyPatches';
import { getByPath } from 'patches/getByPath';
import type { Order, Item, Warehouse } from 'types';
import type { UserEdit, Conflict } from './types';

function buildViewEntity<T extends object>(source: T, edits: Record<string, UserEdit>): T {
  const clone = structuredClone(source);
  applyPatches(clone, edits);
  return clone;
}

export const selectOrdersView = (state: RootState): Order[] => {
  const serverOrders = orderApi.endpoints.getOrders.select()(state).data ?? [];
  return serverOrders.map(order =>
    buildViewEntity(order, state.edits.propertyEdits[order.id] ?? {})
  );
};

export const selectOrderView = (orderId: string) => (state: RootState): Order | undefined => {
  const serverOrders = orderApi.endpoints.getOrders.select()(state).data ?? [];
  const serverOrder = serverOrders.find(o => o.id === orderId);
  if (!serverOrder) return undefined;
  return buildViewEntity(serverOrder, state.edits.propertyEdits[orderId] ?? {});
};

export const selectOrderItemsView = (orderId: string) => (state: RootState): Item[] => {
  const serverItems = itemApi.endpoints.searchItems.select({ orderId })(state).data ?? [];
  const deletedIds = new Set(
    Object.entries(state.edits.deletedEntityIds['item'] ?? {})
      .filter(([, pid]) => pid === orderId)
      .map(([id]) => id)
  );
  const addedItems = Object.values(state.edits.addedEntities['item'] ?? {}).filter(
    e => e._parentId === orderId
  ) as Item[];
  const mergedServerItems = serverItems
    .filter(item => !deletedIds.has(item.id))
    .map(item => buildViewEntity(item, state.edits.propertyEdits[item.id] ?? {}));
  return [...mergedServerItems, ...addedItems];
};

// Items that need to be upserted on save: newly added + server items with edits applied.
export const selectOrderUpsertItems = (orderId: string) => (state: RootState): Item[] => {
  const addedItems = Object.values(state.edits.addedEntities['item'] ?? {}).filter(
    e => e._parentId === orderId
  ) as Item[];
  const serverItems = itemApi.endpoints.searchItems.select({ orderId })(state).data ?? [];
  const editedServerItems = serverItems
    .filter(item => Object.keys(state.edits.propertyEdits[item.id] ?? {}).length > 0)
    .map(item => buildViewEntity(item, state.edits.propertyEdits[item.id] ?? {}));
  return [...addedItems, ...editedServerItems];
};

export const selectItemView = (itemId: string, orderId: string) => (state: RootState): Item | undefined => {
  const serverItems = itemApi.endpoints.searchItems.select({ orderId })(state).data ?? [];
  const serverItem = serverItems.find(i => i.id === itemId);
  if (!serverItem) return undefined;
  return buildViewEntity(serverItem, state.edits.propertyEdits[itemId] ?? {});
};

// Warehouses embedded in an item, with property edits, additions, and deletions applied.
export const selectItemWarehousesView = (itemId: string, orderId: string) => (state: RootState): Warehouse[] => {
  const itemView = selectItemView(itemId, orderId)(state);
  const serverWarehouses = itemView?.warehouses ?? [];
  const deletedIds = new Set(
    Object.entries(state.edits.deletedEntityIds['warehouse'] ?? {})
      .filter(([, pid]) => pid === itemId)
      .map(([id]) => id)
  );
  const addedWarehouses = Object.values(state.edits.addedEntities['warehouse'] ?? {})
    .filter(e => e._parentId === itemId) as unknown as Warehouse[];
  return [
    ...serverWarehouses.filter(w => !deletedIds.has(w.id)),
    ...addedWarehouses,
  ];
};

export const selectOrderConflicts = (orderId: string) => (state: RootState): Conflict[] => {
  const serverOrders = orderApi.endpoints.getOrders.select()(state).data ?? [];
  const serverOrder = serverOrders.find(o => o.id === orderId);
  if (!serverOrder) return [];
  const edits = state.edits.propertyEdits[orderId] ?? {};
  return Object.values(edits)
    .filter(edit => getByPath(serverOrder, edit.path) !== edit.originalValue)
    .map(edit => ({
      entityId: orderId,
      path: edit.path,
      originalValue: edit.originalValue,
      editedValue: edit.editedValue,
      currentServerValue: getByPath(serverOrder, edit.path),
    }));
};

export const selectItemConflicts = (orderId: string) => (state: RootState): Conflict[] => {
  const serverItems = itemApi.endpoints.searchItems.select({ orderId })(state).data ?? [];
  return serverItems.flatMap(item => {
    const edits = state.edits.propertyEdits[item.id] ?? {};
    return Object.values(edits)
      .filter(edit => getByPath(item, edit.path) !== edit.originalValue)
      .map(edit => ({
        entityId: item.id,
        path: edit.path,
        originalValue: edit.originalValue,
        editedValue: edit.editedValue,
        currentServerValue: getByPath(item, edit.path),
      }));
  });
};
