export interface Order {
  id: string;
  name: string;
  itemsCount?: string | number;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export interface Item {
  id: string;
  name: string;
  _parentId: string;
  warehouses: Warehouse[];
}
