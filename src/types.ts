export interface Order {
  id: string;
  name: string;
  itemsCount?: string | number;
  __isDirty?: boolean;
}

export interface Item {
  id: string;
  name: string;
  _orderId: string;
  __isDirty?: boolean;
}
