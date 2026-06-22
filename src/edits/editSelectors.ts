import type { RootState } from 'app/store';
import { itemApi } from 'features/item/itemApi';
import type { BaseEntity } from './types';

export const selectEntityEdits = (entityId: string) => (state: RootState) =>
  state.edits.propertyEdits[entityId] ?? {};

export const selectAddedEntitiesOfType = <T extends BaseEntity>(
  entityType: string,
  parentId: string
) => (state: RootState): T[] =>
  Object.values(state.edits.addedEntities[entityType] ?? {}).filter(
    e => e._parentId === parentId
  ) as T[];

export const selectDeletedEntityIdsOfType = (
  entityType: string,
  parentId: string
) => (state: RootState): string[] =>
  Object.entries(state.edits.deletedEntityIds[entityType] ?? {})
    .filter(([, pid]) => pid === parentId)
    .map(([id]) => id);

export const selectIsLocalEntity = (
  entityType: string,
  entityId: string
) => (state: RootState): boolean =>
  entityId in (state.edits.addedEntities[entityType] ?? {});

export const selectOrderHasLocalChanges = (orderId: string) => (state: RootState): boolean => {
  const hasOrderEdits = Object.keys(state.edits.propertyEdits[orderId] ?? {}).length > 0;
  const hasAddedItems = Object.values(state.edits.addedEntities['item'] ?? {}).some(
    e => e._parentId === orderId
  );
  const hasDeletedItems = Object.values(state.edits.deletedEntityIds['item'] ?? {}).some(
    pid => pid === orderId
  );
  const serverItems = itemApi.endpoints.searchItems.select({ orderId })(state).data ?? [];
  const hasItemEdits = serverItems.some(
    item => Object.keys(state.edits.propertyEdits[item.id] ?? {}).length > 0
  );
  return hasOrderEdits || hasAddedItems || hasDeletedItems || hasItemEdits;
};
