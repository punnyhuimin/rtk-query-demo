import { ModuleRegistry } from 'ag-grid-community';
import {
  ClientSideRowModelModule,
  ValidationModule,
  RowSelectionModule,
  TextEditorModule,
  NumberEditorModule,
  DateEditorModule,
  CheckboxEditorModule,
  LargeTextEditorModule,
  SelectEditorModule,
  CustomEditorModule
} from 'ag-grid-community';

import './App.css';
import { useCallback } from 'react';
import Loading from './app/Loading';
import Workspaces from './features/workspace/Workspaces';
import Orders from './features/order/Orders';
import Items from './features/item/Items';
import { useIsLoading } from './features/api/utils';
import { useUndoRedoShortcut } from './edits/useUndoRedoShortcut';
import { workspaceApi } from 'features/workspace/workspaceApi';
import { orderApi } from 'features/order/orderApi';
import type { RootState } from 'app/store';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  RowSelectionModule,
  TextEditorModule,
  NumberEditorModule,
  DateEditorModule,
  CheckboxEditorModule,
  LargeTextEditorModule,
  SelectEditorModule,
  CustomEditorModule,
]);

function App() {
  const isLoading = useIsLoading();

  const isLocked = useCallback((id: string, state: RootState) => {
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
  }, []);

  useUndoRedoShortcut(isLocked);
  return (
    <div className="App">
      { isLoading && <Loading />}
      <h1>Workspaces</h1>
      <Workspaces />
      <h1>Orders</h1>
      <Orders />
      <h1>Items</h1>
      <Items />
    </div>
  );
}

export default App;
