import type { DefinitionsFromApi, QueryKeys } from '@reduxjs/toolkit/query';
import type { orderApi } from 'features/order/orderApi';
import type { itemApi } from 'features/item/itemApi';
import type { workspaceApi } from 'features/workspace/workspaceApi';

/**
 * Merged endpoint definitions of every api created via api.injectEndpoints.
 * The base api is created with empty endpoints (code-splitting pattern), so
 * its own Definitions type is {} — the real endpoint types live on the
 * injected apis and are recombined here.
 *
 * Imports are type-only, so the runtime cycle
 * (orderApi/itemApi → trackableUpdate → this module) is erased at compile.
 */
export type ApiDefinitions =
  DefinitionsFromApi<typeof orderApi> &
  DefinitionsFromApi<typeof itemApi> &
  DefinitionsFromApi<typeof workspaceApi>;

/**
 * Union of all query endpoint names, e.g. 'getOrders' | 'getWorkspaces' |
 * 'getItemById' | 'searchItems' | 'searchItemsBatch'. Mutations are excluded —
 * only query caches can be edited via updateQueryData.
 */
export type ApiQueryName = QueryKeys<ApiDefinitions>;
