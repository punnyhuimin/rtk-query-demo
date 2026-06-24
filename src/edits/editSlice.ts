import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { EditableValue } from 'types/EditableValue';
import type { UserEdit } from 'types/UserEdit';

type EditsState = {
  fields: Record<string, Record<string, UserEdit>>;  // entityKey → path → UserEdit
  additions: Record<string, any[]>;                   // parentEntityKey → added entities
  deletions: Record<string, string[]>;                // parentEntityKey → deleted entity ids
};

const initialState: EditsState = {
  fields: {},
  additions: {},
  deletions: {},
};

export const editSlice = createSlice({
  name: 'edits',
  initialState,
  reducers: {
    createOrUpdateEdit: (
      state,
      action: PayloadAction<{
        entityKey: string;
        path: string;
        originalValue: EditableValue;
        editedValue: EditableValue;
      }>
    ) => {
      const { entityKey, path, originalValue, editedValue } = action.payload;
      const existingEdit = state.fields[entityKey]?.[path];
      const trueOriginalValue = existingEdit ? existingEdit.originalValue : originalValue;

      if (editedValue === trueOriginalValue) {
        if (existingEdit) {
          delete state.fields[entityKey][path];
          if (Object.keys(state.fields[entityKey]).length === 0) {
            delete state.fields[entityKey];
          }
        }
        return;
      }

      if (!state.fields[entityKey]) {
        state.fields[entityKey] = {};
      }

      state.fields[entityKey][path] = {
        path,
        originalValue: trueOriginalValue,
        editedValue,
        timestamp: Date.now(),
      };
    },

    clearEntityEdits: (state, action: PayloadAction<string>) => {
      delete state.fields[action.payload];
    },

    addEntityEdit: (
      state,
      action: PayloadAction<{ parentKey: string; entity: any }>
    ) => {
      const { parentKey, entity } = action.payload;
      if (!state.additions[parentKey]) {
        state.additions[parentKey] = [];
      }
      state.additions[parentKey].push(entity);
    },

    removeEntityAddition: (
      state,
      action: PayloadAction<{ parentKey: string; entityId: string }>
    ) => {
      const { parentKey, entityId } = action.payload;
      if (!state.additions[parentKey]) return;
      state.additions[parentKey] = state.additions[parentKey].filter(
        (e: any) => e.id !== entityId
      );
      if (state.additions[parentKey].length === 0) {
        delete state.additions[parentKey];
      }
    },

    addEntityDeletion: (
      state,
      action: PayloadAction<{ parentKey: string; entityId: string }>
    ) => {
      const { parentKey, entityId } = action.payload;
      if (!state.deletions[parentKey]) {
        state.deletions[parentKey] = [];
      }
      if (!state.deletions[parentKey].includes(entityId)) {
        state.deletions[parentKey].push(entityId);
      }
    },

    clearParentEdits: (state, action: PayloadAction<string>) => {
      delete state.additions[action.payload];
      delete state.deletions[action.payload];
    },
  },
});

export const {
  createOrUpdateEdit,
  clearEntityEdits,
  addEntityEdit,
  removeEntityAddition,
  addEntityDeletion,
  clearParentEdits,
} = editSlice.actions;

export default editSlice.reducer;
