import type { EditableValue } from './EditableValue';

export type UserEdit<T extends EditableValue = EditableValue> = {
  path: string;
  originalValue: T;
  editedValue: T;
  timestamp: number;
};
