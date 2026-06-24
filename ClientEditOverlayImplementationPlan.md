# Client Edit Overlay — Implementation Plan

## Context

The previous implementation tracked unsaved changes with a `__isDirty` boolean embedded directly in RTK Query cache entries. This entangled server data with user edits, prevented field-level visibility into what changed, and made conflict detection impossible when the backend updated a field the user had also edited.

This plan replaces that approach with the architecture defined in `ClientEditOverlayArchitecture.md`: RTK Query holds server truth exclusively, a dedicated `editSlice` holds field-level user edits, and view selectors merge the two at read time.

---

## Core Principle

> **Never mutate the RTK Query cache with user edits.**

The cache is always server truth. All edits live in a separate Redux slice. UI components consume merged view state from selectors.

---

## Redux Store Structure

```ts
{
  api:     RTK Query cache,   // server truth — never touched by user edits
  order:   orderSlice,
  vehicle: vehicleSlice,
  edits:   editSlice          // NEW — field-level user edits
}
```

### `editSlice` shape

```ts
{
  [entityKey: string]: {       // e.g. "ORDER:abc123" or "VEHICLE:xyz"
    [path: string]: UserEdit;  // e.g. "name", "engines[id=e1].mileage"
  }
}
```

**`entityKey` convention:** `"${EntityType}:${id}"` — helper `entityKey(type, id)` in `src/types/EntityType.ts`.

---

## New Files

```
src/
├── types/
│   ├── EditableValue.ts    — recursive union of all JSON-serialisable value types
│   ├── UserEdit.ts         — generic<T> edit record with path/originalValue/editedValue/timestamp
│   ├── Conflict.ts         — generic<T> derived conflict type (not stored, computed on demand)
│   └── EntityType.ts       — EntityType enum + entityKey() helper
│
├── patches/
│   ├── resolvePath.ts      — parse "engines[id=e1].mileage" → { parent, key }
│   ├── getByPath.ts        — read a value at a path
│   ├── setByPath.ts        — write a value at a path (mutates in-place)
│   ├── applyPatch.ts       — thin wrapper over setByPath
│   └── applyPatches.ts     — apply all edits in a Record<path, UserEdit>
│
├── edits/
│   ├── editSlice.ts        — Redux slice; actions: createOrUpdateEdit, clearEntityEdits
│   └── editActions.ts      — re-exports slice actions (barrel)
│
└── selectors/
    ├── viewSelectors.ts    — buildEntityView, makeSelectEntityView, selectEntityIsDirty
    └── conflictSelectors.ts — selectEntityConflicts
```

---

## Key Types

### `EditableValue`

```ts
type EditableValue =
  | string | number | boolean | null
  | EditableValue[]
  | { [key: string]: EditableValue };
```

### `UserEdit<T>`

```ts
type UserEdit<T extends EditableValue = EditableValue> = {
  path: string;
  originalValue: T;   // captured on FIRST edit; never overwritten on re-edits
  editedValue: T;
  timestamp: number;
};
```

### `Conflict<T>`

```ts
type Conflict<T extends EditableValue = EditableValue> = {
  entityKey: string;
  path: string;
  originalValue: T;
  editedValue: T;
  currentServerValue: T;   // from RTK Query cache at time of check
};
```

---

## Path Syntax

ID-based, not index-based — survives reordering, insertion, and deletion.

| Path | Meaning |
|------|---------|
| `name` | Flat field |
| `engines[id=e1].name` | Nested field in array item |
| `engines[id=e1].details[id=d1].mileage` | Deeply nested |

Segment format parsed by `resolvePath`:
- `fieldName` → property access
- `fieldName[key=value]` → find array item where `item[key] === value`

---

## `editSlice` Actions

### `createOrUpdateEdit`

```ts
dispatch(createOrUpdateEdit({ entityKey, path, originalValue, editedValue }))
```

- If `editedValue === trueOriginalValue` → removes the edit (auto-clean; no edit remains)
- Otherwise → upserts `{ path, originalValue: trueOriginalValue, editedValue, timestamp }`
- `trueOriginalValue` = existing `originalValue` if path already edited, else the supplied `originalValue`
- **`originalValue` is never overwritten on subsequent edits to the same path**

### `clearEntityEdits`

```ts
dispatch(clearEntityEdits(entityKey))
```

Removes all edits for that entity — called after a successful save.

---

## View Selectors

### `buildEntityView<T>(sourceEntity, edits): T`

Clones the server entity and applies all edits via `applyPatches`. Returns merged view. O(edits) — does not clone when there are no edits.

### `selectEntityIsDirty(state, entityKey): boolean`

`Object.keys(state.edits[entityKey] ?? {}).length > 0`

### `selectEntityConflicts(state, entityKey, serverEntity): Conflict[]`

For each edit, reads `currentServerValue = getByPath(serverEntity, edit.path)`.  
Returns a conflict if `currentServerValue !== edit.originalValue`.

---

## Conflict Detection Rule

```
conflict = currentServerValue !== edit.originalValue
```

| Server at edit time | User edited to | Server now | Conflict? |
|---------------------|---------------|------------|-----------|
| 10 | 50 | 10 | No |
| 10 | 50 | 15 | **Yes** |

Conflicts are derived — never stored. Computed on demand via `selectEntityConflicts`.

---

## Component Integration

### Reading data

```ts
const { data: serverVehicles } = useGetOrderVehiclesQuery(selectedOrder?.id);
const allEdits = useSelector((state: RootState) => state.edits);

const vehicles = useMemo(
  () => serverVehicles?.map(v =>
    buildEntityView(v, allEdits[entityKey(EntityType.VEHICLE, v.id)] ?? {})
  ),
  [serverVehicles, allEdits],
);
// Pass `vehicles` as rowData — AG Grid always sees the merged view
```

### Writing edits (AG Grid `onCellEditRequest`)

```ts
const { data, colDef: { field }, oldValue, newValue } = event;
dispatch(createOrUpdateEdit({
  entityKey: entityKey(EntityType.VEHICLE, data!.id),
  path: field!,
  originalValue: oldValue,
  editedValue: newValue,
}));
// RTK Query cache is NOT touched
```

`oldValue` from AG Grid is the merged-view value. On a first edit this equals the server value. On re-edits, `editSlice.createOrUpdateEdit` preserves the stored `originalValue`, so conflict detection remains accurate.

### Dirty detection

```ts
const isDirty = useSelector((state: RootState) =>
  selectEntityIsDirty(state, entityKey(EntityType.ORDER, orderId)) ||
  serverVehicles?.some(v => selectEntityIsDirty(state, entityKey(EntityType.VEHICLE, v.id)))
);
```

### Save flow

```ts
// 1. Build view state for dirty vehicles
const editedVehicles = serverVehicles?.reduce<Vehicle[]>((acc, v) => {
  const key = entityKey(EntityType.VEHICLE, v.id);
  const vehicleEdits = allEdits[key];
  if (vehicleEdits && Object.keys(vehicleEdits).length > 0) {
    acc.push(buildEntityView(v, vehicleEdits));
  }
  return acc;
}, []) ?? [];

// 2. Save to server
await Promise.all([upsertOrder(orderView), upsertAndDeleteOrderVehicles({ ... })]);

// 3. Clear edits — RTK Query re-fetch will restore server truth
savedKeys.forEach(key => dispatch(clearEntityEdits(key)));
```

---

## Changes to Existing Files

| File | Change |
|------|--------|
| `src/types.ts` | Remove `__isDirty` from `Order` and `Vehicle` |
| `src/app/store.ts` | Add `edits: editReducer` |
| `src/features/order/orderApi.ts` | Remove `transformResponse`, `merge` callback, `onQueryStarted` that cleared `__isDirty`, `updateOrderAction` |
| `src/features/vehicle/vehicleApi.ts` | `editOrderVehicleAction` → dispatches `createOrUpdateEdit`; add/delete actions keep RTK cache mutation with TODO markers |
| `src/features/vehicle/Vehicles.tsx` | `rowData` from merged view; `onCellEditRequest` dispatches field-level edit |
| `src/features/order/Orders.tsx` | Same pattern as Vehicles |
| `src/features/order/OrderCellRenderer.tsx` | Dirty/conflict from selectors; save dispatches `clearEntityEdits` on success |
| `src/mocks/services/utils.ts` | Remove `mergeRetainDirty` (no longer needed) |

---

## Additions / Deletions — TODO

> **Additions and deletions must NOT be pushed into the RTK Query cache.** This violates the core principle (cache = server truth only) and blocks undo/redo, conflict detection on new rows, and batch-save workflows. They must be migrated to a dedicated `ADD` / `DELETE` edit type inside `editSlice`.

For this iteration only, `addOrderVehicleAction` and `deleteOrderVehicleAction` continue to mutate the RTK Query cache via `updateQueryData`. These are marked with:

```ts
// TODO: migrate to editSlice ADD/DELETE type — pushing to RTK Query cache violates cache-purity rule
```

---

## Verification

1. **Edit survives backend refresh** — Edit vehicle name → RTK Query refetch → grid still shows edited value; Redux DevTools shows server cache unchanged; `edits` slice holds the diff.

2. **Conflict detection** — Edit `name` to `"A"` (server was `"B"`) → simulate server returning `"C"` → `selectEntityConflicts` returns conflict; Save button shows `"Save (!)"`.

3. **Auto-clean** — Edit field from `"B"` to `"X"`, then back to `"B"` → `editSlice` shows no entry for that path → `selectEntityIsDirty` returns `false`.

4. **Save clears edits** — Save succeeds → `clearEntityEdits` dispatched → `selectEntityIsDirty` returns `false` → Save button disables.

5. **Nested path** — Edit `engines[id=x].mileage` → `getByPath` / `setByPath` resolve correctly → merged view shows updated value; RTK cache entry unchanged.

6. **Tests** — `vehicleApi.test.ts` passes unchanged (cache behaviour untouched). Add unit tests for `resolvePath`, `buildEntityView`, `selectEntityConflicts`.
