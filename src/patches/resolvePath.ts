const ID_SEG = /^\[id=(.+)]$/;

export type Resolved = {
  parent: Record<string | number, unknown> | unknown[];
  key: string | number;
};

/**
 * Traverses a nested structure using an id-based dot-slash path.
 *
 * Segment forms:
 *   [id=abc]  — looks up an array element by its .id property
 *   name      — plain object key
 *
 * Example path: "[id=abc]/deliveries/[id=xyz]/location/lat"
 */
export function resolvePath(root: unknown, path: string): Resolved {
  const segments = path.split('/');
  let node: unknown = root;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const m = seg.match(ID_SEG);
    if (m) {
      node = (node as Array<{ id: unknown }>).find(item => item.id === m[1]);
    } else {
      node = (node as Record<string, unknown>)[seg];
    }
    if (node == null) return { parent: {} as Record<string, unknown>, key: '' };
  }

  const last = segments[segments.length - 1];
  const m = last.match(ID_SEG);
  if (m && Array.isArray(node)) {
    return {
      parent: node,
      key: node.findIndex((item: { id: unknown }) => item.id === m[1]),
    };
  }

  return { parent: node as Record<string | number, unknown>, key: last };
}
