# Client Edit Overlay Architecture
## RTK Query + AG Grid + ArcGIS

---

# Objective

Allow users to edit data locally while continuing to receive backend updates.

Requirements

- RTK Query remains the source of server data.
- User edits must survive backend refreshes.
- Backend changes must continue to flow into the UI.
- Detect conflicts when the backend changes a value that the user has edited.
- Support deeply nested object structures.
- Support edits originating from
  - AG Grid
  - ArcGIS interactions
  - Other UI components
- Avoid implementing undoredo initially.
- Keep architecture extensible for future undoredo support.

---

# High-Level Architecture

```text
RTK Query Cache
(Server Truth)

        +
        +

User Edits
(Redux store)

        ↓

Merged View State

        ↓

AG Grid
ArcGIS
Panels
Forms
```

---

# Core Principle

Never mutate RTK Query data.

Instead

```text
Server Data
      +
User Edits
      ↓
View State
```

All user interactions create edits.

All UI components consume merged view state.

---

# Redux Store Structure

Entity ID is the enum Entity. E.g. ORDER, VEHICLE, ENGINE.

```ts
{
  api RTK Query cache,

  edits {
    [entityId string] {
      [path string] UserEdit;
    };
  }
}
```

---

# User Edit Structure

```ts
type UserEdit = {
  path string;

  originalValue unknown;

  editedValue unknown;

  timestamp number;
};
```

Example

```ts
{
  company-x {
    order[id=y].delivery[id=b].location.lat {
      path order[id=y].delivery[id=b].location.lat,

      originalValue 10,

      editedValue 50,

      timestamp 1700000000
    }
  }
}
```

---

# Why Store originalValue

Conflict detection.

Suppose

Initial server value

```ts
lat = 10
```

User edits

```ts
lat = 50
```

Store

```ts
{
  originalValue 10,
  editedValue 50
}
```

Later the backend updates

```ts
lat = 15
```

We can detect

```ts
currentServerValue !== originalValue
```

which means

```text
Conflict detected
```

---

# Path Strategy

Avoid array indexes.

❌ Bad

```text
delivery[0].goods[2].location.lat
```

✅ Good

```text
order[id=y]
.delivery[id=b]
.goods[id=a]
.location.lat
```

Benefits

- Survives reordering
- Survives insertion
- Survives deletion
- Survives backend refreshes

---

# Path Examples

```text
location.lat
```

```text
delivery[id=b].location.lat
```

```text
order[id=y]
.delivery[id=b]
.goods[id=a]
.location.lat
```

---

# Required Path Utilities

## getByPath

Reads a value.

```ts
getByPath(
  entity,
  delivery[id=b].location.lat
)
```

Returns

```ts
50
```

---

## setByPath

Writes a value.

```ts
setByPath(
  entity,
  delivery[id=b].location.lat,
  50
)
```

---

## resolvePath

Resolves

```text
delivery[id=b].location.lat
```

into

```ts
{
  parent,
  key
}
```

Example

```ts
{
  parent locationObject,
  key lat
}
```

---

# applyPatch

Purpose

Apply a single edit to an object.

Signature

```ts
applyPatch(
  root,
  path,
  value
)
```

Implementation

```ts
function applyPatch(
  root,
  path,
  value
) {
  const { parent, key } =
    resolvePath(root, path);

  parent[key] = value;
}
```

---

# applyPatches

Purpose

Apply all edits to a cloned entity.

Implementation

```ts
function applyPatches(
  root,
  edits
) {
  Object.values(edits)
    .forEach(edit =
      applyPatch(
        root,
        edit.path,
        edit.editedValue
      )
    );
}
```

---

# Edit Creation Flow

Example

Server value

```ts
lat = 10
```

User changes

```ts
lat = 50
```

Store

```ts
{
  originalValue 10,
  editedValue 50
}
```

---

# Edit Update Flow

User edits again

```ts
50 → 60
```

Update

```ts
{
  originalValue 10,
  editedValue 60
}
```

Important

```text
originalValue never changes
```

until edit is cleared.

---

# Edit Removal Flow

Server value

```ts
lat = 10
```

User

```ts
10 → 50
```

Later

```ts
50 → 10
```

Since

```ts
editedValue === originalValue
```

remove the edit entirely.

Result

```ts
{}
```

No edit remains.

---

# View State Selector

Purpose

Merge RTK Query data with user edits.

Implementation

```ts
function buildViewEntity(
  sourceEntity,
  edits
) {
  const clone =
    structuredClone(sourceEntity);

  applyPatches(
    clone,
    edits
  );

  return clone;
}
```

---

# View Selector Example

```ts
selectEntityView(entityId)
```

Returns

```text
Source Data
+
User Edits
```

Result

```ts
{
  location {
    lat 50
  }
}
```

even if server still contains

```ts
{
  location {
    lat 10
  }
}
```

---

# Conflict Detection

Purpose

Detect backend changes that occurred after user editing began.

---

## Conflict Rule

Given

```ts
{
  originalValue,
  editedValue
}
```

Retrieve current server value

```ts
currentServerValue
```

Conflict

```ts
currentServerValue !== originalValue
```

---

# No Conflict Example

Server

```ts
10
```

User

```ts
10 → 50
```

Current server

```ts
10
```

Check

```ts
10 === 10
```

Result

```text
No conflict
```

---

# Conflict Example

Server

```ts
10
```

User

```ts
10 → 50
```

Backend refresh

```ts
15
```

Check

```ts
15 !== 10
```

Result

```text
Conflict detected
```

---

# Conflict Model

Derived only.

Not stored.

```ts
type Conflict = {
  entityId string;

  path string;

  originalValue unknown;

  editedValue unknown;

  currentServerValue unknown;
};
```

---

# Conflict Selector

```ts
selectEntityConflicts(
  entityId
)
```

Returns

```ts
Conflict[]
```

Example

```ts
[
  {
    path ...location.lat,

    originalValue 10,

    editedValue 50,

    currentServerValue 15
  }
]
```

---

# Dirty State

Derived.

```ts
selectEntityIsDirty(
  entityId
)
```

Implementation

```ts
Object.keys(edits).length  0
```

---

# Component Usage

## AG Grid

Reads

```ts
selectEntityView(...)
```

Writes

```ts
createOrUpdateEdit(...)
```

Never mutates RTK Query data.

---

## ArcGIS

Reads

```ts
selectEntityView(...)
```

Writes

```ts
createOrUpdateEdit(...)
```

Never mutates RTK Query data.

---

# Required Files

```text
src

├── api
│   └── api.ts
│
├── edits
│   ├── editSlice.ts
│   ├── editActions.ts
│   └── editSelectors.ts
│
├── patches
│   ├── resolvePath.ts
│   ├── getByPath.ts
│   ├── setByPath.ts
│   ├── applyPatch.ts
│   └── applyPatches.ts
│
├── selectors
│   ├── viewSelectors.ts
│   └── conflictSelectors.ts
│
└── types
    ├── UserEdit.ts
    └── Conflict.ts
```

---

# Future Expansion

This architecture is intentionally compatible with

- Undo  Redo
- Transactions
- Batch editing
- Save workflows
- Conflict resolution workflows
- Collaborative editing

without requiring changes to

- RTK Query cache
- Path system
- View selectors
- Conflict detection logic