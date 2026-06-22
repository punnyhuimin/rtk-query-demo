import type { CellEditRequestEvent } from 'ag-grid-community';

export const getEditedRowItem = <T>(cellEditRequestEvent: CellEditRequestEvent<T>): T => {
  const { data, colDef: { field }, newValue } = cellEditRequestEvent;
  return { ...(data as object), [field!]: newValue } as T;
};
