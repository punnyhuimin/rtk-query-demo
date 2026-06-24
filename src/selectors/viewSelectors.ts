import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from 'app/store';
import type { UserEdit } from 'types/UserEdit';
import { applyPatches } from 'patches/applyPatches';

export function buildEntityView<T>(sourceEntity: T, edits: Record<string, UserEdit>): T {
  if (Object.keys(edits).length === 0) return sourceEntity;
  const clone = structuredClone(sourceEntity);
  applyPatches(clone, edits);
  return clone;
}

export const makeSelectEntityView = <T>(key: string) =>
  createSelector(
    [(state: RootState) => state.edits.fields[key] ?? {}, (_: RootState, entity: T) => entity],
    (edits, entity) => buildEntityView(entity, edits)
  );

export const selectEntityIsDirty = (state: RootState, key: string): boolean =>
  Object.keys(state.edits.fields[key] ?? {}).length > 0;
