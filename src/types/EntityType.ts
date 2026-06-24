export enum EntityType {
  ORDER = 'ORDER',
  VEHICLE = 'VEHICLE',
}

export const entityKey = (type: EntityType, id: string) => `${type}:${id}`;
