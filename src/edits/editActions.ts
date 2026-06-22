import type { AppDispatch, RootState } from 'app/store';
import { itemApi } from 'features/item/itemApi';
import { clearAllEdits, clearChildEntitiesOverlay } from './editSlice';

export const clearOrderAllEditsThunk =
  (orderId: string) => (dispatch: AppDispatch, getState: () => RootState) => {
    const serverItemIds =
      itemApi.endpoints.searchItems.select({ orderId })(getState()).data?.map(i => i.id) ?? [];
    dispatch(clearAllEdits({
      entityIds: [orderId, ...serverItemIds],
      childGroups: [
        { entityType: 'item', parentIds: [orderId] },
        { entityType: 'warehouse', parentIds: serverItemIds },
      ],
    }));
  };

export const clearOrderItemsThunk =
  (orderId: string) => (dispatch: AppDispatch, getState: () => RootState) => {
    const serverItemIds =
      itemApi.endpoints.searchItems.select({ orderId })(getState()).data?.map(i => i.id) ?? [];
    dispatch(clearChildEntitiesOverlay({
      entityType: 'item',
      parentId: orderId,
      serverChildIds: serverItemIds,
    }));
  };
