# Client Edit Overlay — Implementation

---

## Three-Layer Model

RTK Query cache (server truth, immutable) **+** edits slice (overlay) **→** view selectors (merged) **→** AG Grid tables

```
╔══════════════════════════════════════════════════════════════════════╗
║                         REDUX STORE                                  ║
║                                                                      ║
║  ┌─────────────────────────────┐  ┌─────────────────────────────┐   ║
║  │         api (RTK Query)     │  │           edits              │   ║
║  │                             │  │                              │   ║
║  │  queries {                  │  │  propertyEdits {             │   ║
║  │    getOrders → Order[]      │  │    [entityId] {              │   ║
║  │    searchItems → Item[]     │  │      [path] → UserEdit {     │   ║
║  │    ...                      │  │        path                  │   ║
║  │  }                          │  │        originalValue         │   ║
║  │                             │  │        editedValue           │   ║
║  │  NEVER MUTATED by           │  │        timestamp             │   ║
║  │  user edits                 │  │      }                       │   ║
║  │                             │  │    }                         │   ║
║  └─────────────────────────────┘  │  }                           │   ║
║           │ server truth          │                              │   ║
║           │                       │  addedItems {                │   ║
║           │                       │    [itemId] → Item           │   ║
║           │                       │  }                           │   ║
║           │                       │                              │   ║
║           │                       │  deletedItemIds {            │   ║
║           │                       │    [itemId] → orderId        │   ║
║           │                       │  }                           │   ║
║           │                       └─────────────────────────────┘   ║
║           │                                    │ user overlay         ║
╚═══════════╪════════════════════════════════════╪═════════════════════╝
            │                                    │
            └──────────────┬─────────────────────┘
                           ▼
            ┌──────────────────────────────────┐
            │          viewSelectors           │
            │                                  │
            │  selectOrdersView                │
            │    structuredClone(serverOrder)  │
            │    applyPatches(clone, edits)    │
            │    → Order[] with edits applied  │
            │                                  │
            │  selectOrderItemsView(orderId)   │
            │    serverItems                   │
            │      .filter(!deletedIds)        │
            │      .map(applyPatches)          │
            │      .concat(addedItems)         │
            │    → Item[] merged               │
            │                                  │
            │  selectOrderHasLocalChanges      │
            │  selectOrderConflicts            │
            │  selectOrderUpsertItems          │
            └──────────────────────────────────┘
                           │ view model
            ┌──────────────┴───────────────┐
            ▼                              ▼
   ┌─────────────────┐           ┌─────────────────┐
   │  Orders (grid)  │           │  Items (grid)   │
   │                 │           │                 │
   │  rowData =      │           │  rowData =      │
   │  ordersView     │           │  itemsView      │
   └─────────────────┘           └─────────────────┘
```

---

## File Structure

```
src
├── edits
│   ├── types.ts          UserEdit, Conflict
│   ├── editSlice.ts      Redux slice — propertyEdits, addedItems, deletedItemIds
│   ├── editSelectors.ts  Pure edit-state selectors
│   ├── editActions.ts    Thunks that need RTK Query state (clearOrderAllEditsThunk, etc.)
│   └── viewSelectors.ts  Merged view selectors + conflict selectors
│
└── patches
    ├── resolvePath.ts    Walk a path string to { parent, key }
    ├── getByPath.ts      Read a value at a path
    ├── setByPath.ts      Write a value at a path (mutates)
    ├── applyPatch.ts     Apply one patch
    └── applyPatches.ts   Apply all edits in Record<path, UserEdit>
```

---

## Component Interactions

```
   ┌─────────────────┐           ┌─────────────────┐
   │  Orders (grid)  │           │  Items (grid)   │
   └────────┬────────┘           └────────┬────────┘
            │ onCellEditRequest            │ onCellEditRequest
            ▼                             ▼
   upsertPropertyEdit({          server item → upsertPropertyEdit
     entityId: order.id,         local item  → updateLocalItem
     path: "name",
     originalValue: "A",         addLocalItem(newItem)
     editedValue: "B",           markItemDeleted({ itemId, orderId })
   })                            removeLocalItem(itemId)
```

---

## Path System

Supports flat properties and id-keyed array traversal. Array indexes are never used.

```
"name"
"location.lat"
"delivery[id=b].location.lat"
"order[id=y].delivery[id=b].goods[id=a].location.lat"
```

Resolution:

```
resolvePath("delivery[id=b].location.lat", root)

  segments: ["delivery[id=b]", "location", "lat"]

  traverse "delivery[id=b]"
    → root["delivery"].find(x => x.id === "b")

  traverse "location"
    → node["location"]

  last "lat"
    → { parent: locationObj, key: "lat" }

setByPath  → parent[key] = value
getByPath  → return parent[key]
```

---

## Edit Slice — Reducer Logic

### upsertPropertyEdit

```
existing = propertyEdits[entityId][path]

resolvedOriginal = existing?.originalValue ?? originalValue
                         ↑
                   never changes after the first edit

if editedValue === resolvedOriginal
  → delete edit          (user reverted to original)
else
  → store {
      originalValue: resolvedOriginal,
      editedValue,
      timestamp,
    }
```

### Edit lifecycle

```
Server value:  lat = 10
User edits:    10 → 50   →  { originalValue: 10, editedValue: 50 }
User edits:    50 → 60   →  { originalValue: 10, editedValue: 60 }  ← originalValue preserved
User edits:    60 → 10   →  edit removed                            ← reverted to original
```

### Add / Delete

```
addLocalItem(item)
  → addedItems[item.id] = item

markItemDeleted({ itemId, orderId })
  → deletedItemIds[itemId] = orderId
  → propertyEdits[itemId] deleted

removeLocalItem(itemId)
  → addedItems[itemId] deleted
  → propertyEdits[itemId] deleted
```

---

## Conflict Detection

Derived only — never stored in Redux.

```
for each edit in propertyEdits[entityId]:

  currentServerValue = getByPath(serverEntity, edit.path)

  conflict = (currentServerValue !== edit.originalValue)

  meaning: the server changed this field after
           the user started editing it
```

Example:

```
Server initial:   lat = 10
User edits:       lat → 50   →  { originalValue: 10, editedValue: 50 }
Server refresh:   lat = 15

currentServerValue (15) !== originalValue (10)  →  CONFLICT
```

Selector: `selectOrderConflicts(orderId)` / `selectItemConflicts(orderId)` → `Conflict[]`

---

## View Selector — selectOrderItemsView

```
selectOrderItemsView(orderId)(state)

  serverItems   = RTK Query cache for orderId
  deletedIds    = Set of deletedItemIds where value === orderId
  addedItems    = addedItems where _orderId === orderId

  return [
    ...serverItems
        .filter(item => !deletedIds.has(item.id))
        .map(item => {
          clone = structuredClone(item)
          applyPatches(clone, propertyEdits[item.id] ?? {})
          return clone
        }),
    ...addedItems,
  ]
```

---

## Save Flow

```
OrderCellRenderer

  selectOrderView(id)         → merged Order  (edits applied)
  selectOrderUpsertItems(id)  → added items + server items that have edits
  selectDeletedItemIdsForOrder(id)  → string[]

  upsertOrder(orderView)
  upsertAndDeleteOrderItems({ orderId, upsertItems, deleteIds })
    ↓ on success
  clearOrderAllEditsThunk(orderId)
    reads serverItemIds from RTK cache
    dispatches clearOrderAllEdits({ orderId, serverItemIds })
    → overlay cleared, RTK Query refetch begins
```

---

## Dirty State

```
selectOrderHasLocalChanges(orderId)

  hasOrderEdits    = propertyEdits[orderId] has entries
  hasAddedItems    = addedItems has items with _orderId === orderId
  hasDeletedItems  = deletedItemIds has entries for this order
  hasItemEdits     = any server item for this order has propertyEdits

  return hasOrderEdits || hasAddedItems || hasDeletedItems || hasItemEdits
```
