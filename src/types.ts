export interface Order {
  id: string;
  name: string;
  vehicleCount?: string | number;
  __isDirty?: boolean;
}

export interface Vehicle {
  id: string;
  name: string;
  _orderId: string;
  __isDirty?: boolean;
  engines: EngineComponent[];
}

export interface EngineComponent {
  id: string;
  name: string;
  _vehicleId: string;
  details: EngineMileage[];
}

export interface EngineMileage {
  id: string;
  name: string;
  _engineComponentId: string;
  mileage: number;
}
