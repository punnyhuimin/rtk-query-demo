import type { FieldEdit, ImmerPatch } from 'types/CacheDiff';

function getAtSegments(obj: unknown, segments: (string | number)[]): unknown {
  return segments.reduce<unknown>((node, seg) => {
    if (node == null) return undefined;
    return (node as Record<string | number, unknown>)[seg];
  }, obj);
}

/**
 * Converts Immer array-index patches to id-based FieldEdits.
 *
 * An Immer patch for an array looks like:
 *   { op: 'replace', path: [3, 'name'], value: 'new' }
 *
 * We convert path[0] (the array index) to "[id=<entity.id>]" using cacheBefore,
 * so the recorded path is "[id=abc]/name" — stable under reordering.
 */
export function convertToIdPaths<T extends { id: string }>(
  cacheBefore: T[],
  patches: ImmerPatch[],
): FieldEdit[] {
  return patches.map(patch => {
    const [indexSeg, ...fieldSegs] = patch.path;
    const entity = cacheBefore[Number(indexSeg)];

    const idPart = entity?.id != null
      ? `[id=${entity.id}]`
      : `[${String(indexSeg)}]`; // fallback when entity has no id

    const fieldStr = fieldSegs.map(String).join('/');
    const fullPath = fieldStr ? `${idPart}/${fieldStr}` : idPart;

    return {
      path: fullPath,
      op: patch.op,
      before: getAtSegments(entity, fieldSegs),
      after: 'value' in patch ? patch.value : undefined,
    };
  });
}
