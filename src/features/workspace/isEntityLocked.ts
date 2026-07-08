import type { RootState } from 'app/store';
import { workspaceApi } from 'features/workspace/workspaceApi';
import { orderApi } from 'features/order/orderApi';

/**
 * Returns true when the workspace or order with the given id must not be
 * mutated: a workspace is locked when it is not editable; an order is locked
 * when its owning workspace is not editable or the order itself is not
 * editable.
 */
export function isEntityLocked(id: string, state: RootState): boolean {
  const workspaces = workspaceApi.endpoints.getWorkspaces.select()(state).data ?? [];

  const workspace = workspaces.find(w => w.id === id);
  if (workspace) return !workspace.isEditable;

  for (const ws of workspaces) {
    const order = orderApi.endpoints.getOrders.select(ws.id)(state).data?.find(o => o.id === id);
    if (order) {
      const owningWorkspace = workspaces.find(w => w.id === order.workspaceId);
      if (owningWorkspace && !owningWorkspace.isEditable) return true;
      return order.isEditable === false;
    }
  }

  return false;
}
