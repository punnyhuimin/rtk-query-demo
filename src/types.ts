export interface Workspace {
  id: string;
  name: string;
  isEditable: boolean;
}

export interface Order {
  id: string;
  name: string;
  status: string;
  workspaceId: string;
  isEditable?: boolean;
  itemsCount?: string | number;
  __isDirty?: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  name: string;
  _orderId: string;
  warehouseCount: number;
  warehouses: Warehouse[];
  __isDirty?: boolean;
}
