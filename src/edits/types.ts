export type UserEdit = {
  path: string;
  originalValue: unknown;
  editedValue: unknown;
  timestamp: number;
};

export type Conflict = {
  entityId: string;
  path: string;
  originalValue: unknown;
  editedValue: unknown;
  currentServerValue: unknown;
};

export interface BaseEntity {
  id: string;
  _parentId: string;
  [key: string]: unknown;
}
