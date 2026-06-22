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
import Loading from './app/Loading';
import Orders from './features/order/Orders';
import Items from './features/item/Items';
import Warehouses from './features/warehouse/Warehouses';
import EditsDebugPanel from './app/EditsDebugPanel';
import { useIsLoading } from './features/api/utils';

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
  return (
    <div className="App">
      { isLoading && <Loading />}
      <h1>Orders</h1>
      <Orders />
      <h1>Items</h1>
      <Items />
      <h1>Warehouses</h1>
      <Warehouses />
      <EditsDebugPanel />
    </div>
  );
}

export default App;
