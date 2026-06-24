import type { EditableValue } from './EditableValue';

export type Conflict<T extends EditableValue = EditableValue> = {
  entityKey: string;
  path: string;
  originalValue: T;
  editedValue: T;
  currentServerValue: T;
};
