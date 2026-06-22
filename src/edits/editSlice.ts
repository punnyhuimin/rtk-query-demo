import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { UserEdit, BaseEntity } from './types';

interface EditsState {
  propertyEdits: Record<string, Record<string, UserEdit>>; // entityId -> path -> UserEdit
  addedEntities: Record<string, Record<string, BaseEntity>>; // entityType -> entityId -> entity
  deletedEntityIds: Record<string, Record<string, string>>; // entityType -> entityId -> parentId
}

const initialState: EditsState = {
  propertyEdits: {},
  addedEntities: {},
  deletedEntityIds: {},
};

export const editSlice = createSlice({
  name: 'edits',
  initialState,
  reducers: {
    upsertPropertyEdit: (
      state,
      action: PayloadAction<{
        entityId: string; // e.g. order id
        path: string;
        originalValue: unknown;
        editedValue: unknown;
      }>
    ) => {
      const { entityId, path, originalValue, editedValue } = action.payload;
      const existing = state.propertyEdits[entityId]?.[path];
      const resolvedOriginal = existing?.originalValue ?? originalValue;

      if (editedValue === resolvedOriginal) {
        if (state.propertyEdits[entityId]) {
          delete state.propertyEdits[entityId][path];
          if (Object.keys(state.propertyEdits[entityId]).length === 0) {
            delete state.propertyEdits[entityId];
          }
        }
        return;
      }

      state.propertyEdits[entityId] ??= {};
      state.propertyEdits[entityId][path] = {
        path,
        originalValue: resolvedOriginal,
        editedValue,
        timestamp: Date.now(),
      };
    },

    clearEntityEdits: (state, action: PayloadAction<string>) => {
      delete state.propertyEdits[action.payload];
    },

    addLocalEntity: (
      state,
      action: PayloadAction<{ entityType: string; entity: BaseEntity }>
    ) => {
      const { entityType, entity } = action.payload;
      state.addedEntities[entityType] ??= {};
      state.addedEntities[entityType][entity.id] = entity;
    },

    updateLocalEntity: (
      state,
      action: PayloadAction<{ entityType: string; entity: BaseEntity }>
    ) => {
      const { entityType, entity } = action.payload;
      if (state.addedEntities[entityType]?.[entity.id] !== undefined) {
        state.addedEntities[entityType][entity.id] = entity;
      }
    },

    removeLocalEntity: (
      state,
      action: PayloadAction<{ entityType: string; entityId: string }>
    ) => {
      const { entityType, entityId } = action.payload;
      delete state.addedEntities[entityType]?.[entityId];
      delete state.propertyEdits[entityId];
    },

    markEntityDeleted: (
      state,
      action: PayloadAction<{ entityType: string; entityId: string; parentId: string }>
    ) => {
      const { entityType, entityId, parentId } = action.payload;
      state.deletedEntityIds[entityType] ??= {};
      state.deletedEntityIds[entityType][entityId] = parentId;
      delete state.propertyEdits[entityId];
    },

    // Marks all current server children as deleted and removes local additions for a parent.
    // serverChildIds must be provided by a thunk since reducers can't access RTK Query state.
    clearChildEntitiesOverlay: (
      state,
      action: PayloadAction<{ entityType: string; parentId: string; serverChildIds: string[] }>
    ) => {
      const { entityType, parentId, serverChildIds } = action.payload;
      state.deletedEntityIds[entityType] ??= {};
      serverChildIds.forEach(childId => {
        state.deletedEntityIds[entityType][childId] = parentId;
        delete state.propertyEdits[childId];
      });
      const added = state.addedEntities[entityType] ?? {};
      Object.keys(added).forEach(id => {
        if (added[id]._parentId === parentId) delete added[id];
      });
    },

    // Clears all overlay state after a successful save.
    // childGroups allows cascading clear across multiple entity types and parent scopes.
    clearAllEdits: (
      state,
      action: PayloadAction<{
        entityIds: string[];
        childGroups: { entityType: string; parentIds: string[] }[];
      }>
    ) => {
      const { entityIds, childGroups } = action.payload;
      entityIds.forEach(id => delete state.propertyEdits[id]);
      for (const { entityType, parentIds } of childGroups) {
        const parentSet = new Set(parentIds);
        const added = state.addedEntities[entityType] ?? {};
        Object.keys(added).forEach(id => {
          if (parentSet.has(added[id]._parentId)) delete added[id];
        });
        const deleted = state.deletedEntityIds[entityType] ?? {};
        Object.keys(deleted).forEach(id => {
          if (parentSet.has(deleted[id])) delete deleted[id];
        });
      }
    },
  },
});

export const {
  upsertPropertyEdit,
  clearEntityEdits,
  addLocalEntity,
  updateLocalEntity,
  removeLocalEntity,
  markEntityDeleted,
  clearChildEntitiesOverlay,
  clearAllEdits,
} = editSlice.actions;

export default editSlice.reducer;
