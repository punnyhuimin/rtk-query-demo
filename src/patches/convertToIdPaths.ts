import { compare, getValueByPointer } from 'fast-json-patch';
import type { AddOperation, RemoveOperation, ReplaceOperation } from 'fast-json-patch';
import type { FieldEdit } from 'types/CacheDiff';

type DiffOperation = AddOperation<unknown> | RemoveOperation | ReplaceOperation<unknown>;

/**
 * Uses fast-json-patch compare() to produce a deep, field-level diff between
 * two entity snapshots. compare() only emits add / remove / replace, so the
 * type-narrowing filter is both a TS guard and a runtime safety net.
 */
function decomposeEntityDiff<T extends object>(
  idPart: string,
  before: T,
  after: T,
): FieldEdit[] {
  return compare(before, after)
    .filter((op): op is DiffOperation =>
      op.op === 'add' || op.op === 'remove' || op.op === 'replace'
    )
    .map(rfcOp => ({
      path: `${idPart}${rfcOp.path}`,
      op: rfcOp.op,
      before: getValueByPointer(before, rfcOp.path),
      after: 'value' in rfcOp ? rfcOp.value : undefined,
    }));
}

/**
 * Produces stable, id-based FieldEdits by comparing cacheBefore and cacheAfter
 * directly — rather than interpreting Immer's raw index patches.
 *
 * Why not use Immer patches?
 * For array.splice(i, 1), Immer emits SHIFT patches (replaces elements at each
 * position after i, then removes the last slot). Those patches don't say "entity
 * X was deleted at index N", making position-correct undo impossible from patches
 * alone. Comparing the two snapshots gives us the semantic intent directly.
 *
 * Three kinds of FieldEdit produced:
 *   remove  — entity present in before, absent in after  (index = original position)
 *   add     — entity absent in before, present in after  (index = position in after)
 *   field   — entity present in both but reference changed; deep-diffed per field
 */
export function convertToIdPaths<T extends { id: string }>(
  cacheBefore: T[],
  cacheAfter: T[],
): FieldEdit[] {
  const result: FieldEdit[] = [];

  const afterById = new Map(cacheAfter.map((e, i) => [e.id, { entity: e, index: i }]));
  const beforeIds = new Set(cacheBefore.map(e => e.id));

  // Removals and field-level changes
  cacheBefore.forEach((entity, index) => {
    const afterEntry = afterById.get(entity.id);
    if (!afterEntry) {
      result.push({
        path: `[id=${entity.id}]`,
        op: 'remove',
        before: entity,
        after: undefined,
        index,
      });
    } else if (afterEntry.entity !== entity) {
      // Reference changed — deep diff at field level
      result.push(...decomposeEntityDiff(`[id=${entity.id}]`, entity, afterEntry.entity));
    }
  });

  // Additions
  cacheAfter.forEach((entity, index) => {
    if (!beforeIds.has(entity.id)) {
      result.push({
        path: `[id=${entity.id}]`,
        op: 'add',
        before: undefined,
        after: entity,
        index,
      });
    }
  });

  return result;
}
