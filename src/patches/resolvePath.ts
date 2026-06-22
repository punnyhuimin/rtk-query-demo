export type PathResolution = {
  parent: Record<string | number, unknown>;
  key: string | number;
};

export function resolvePath(root: unknown, path: string): PathResolution {
  const segments = path.split('.');
  let current: unknown = root;

  for (let i = 0; i < segments.length - 1; i++) {
    current = traverseSegment(current, segments[i]);
  }

  return resolveLastSegment(current, segments[segments.length - 1]);
}

function traverseSegment(node: unknown, segment: string): unknown {
  const match = segment.match(/^(\w+)\[(\w+)=(.+)\]$/);
  if (match) {
    const [, key, idKey, idValue] = match;
    const arr = (node as Record<string, unknown>)[key] as Array<Record<string, unknown>>;
    return arr.find(item => String(item[idKey]) === idValue);
  }
  return (node as Record<string, unknown>)[segment];
}

function resolveLastSegment(node: unknown, segment: string): PathResolution {
  const match = segment.match(/^(\w+)\[(\w+)=(.+)\]$/);
  if (match) {
    const [, key, idKey, idValue] = match;
    const arr = (node as Record<string, unknown>)[key] as Array<Record<string, unknown>>;
    const index = arr.findIndex(item => String(item[idKey]) === idValue);
    return { parent: arr as unknown as Record<string | number, unknown>, key: index };
  }
  return { parent: node as Record<string | number, unknown>, key: segment };
}
