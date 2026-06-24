function splitPath(path: string): string[] {
  const segments: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of path) {
    if (char === '[') depth++;
    else if (char === ']') depth--;
    else if (char === '.' && depth === 0) {
      segments.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) segments.push(current);
  return segments;
}

const SEGMENT_REGEX = /^([^\[]+)(?:\[([^=]+)=([^\]]+)\])?$/;

function parseSegment(segment: string): { prop: string; filterKey?: string; filterValue?: string } {
  const match = segment.match(SEGMENT_REGEX);
  if (!match) throw new Error(`Invalid path segment: "${segment}"`);
  const [, prop, filterKey, filterValue] = match;
  return { prop, filterKey, filterValue };
}

export function resolvePath(root: unknown, path: string): { parent: any; key: string | number } {
  const segments = splitPath(path);
  if (segments.length === 0) throw new Error('Path must not be empty');

  let current: any = root;

  for (let i = 0; i < segments.length - 1; i++) {
    const { prop, filterKey, filterValue } = parseSegment(segments[i]);
    let next = current[prop];
    if (filterKey !== undefined) {
      if (!Array.isArray(next)) throw new Error(`Expected array at "${prop}"`);
      next = next.find((item: any) => String(item[filterKey]) === filterValue);
    }
    if (next == null) throw new Error(`Path resolution failed at segment "${segments[i]}"`);
    current = next;
  }

  const lastSegment = segments[segments.length - 1];
  const { prop, filterKey, filterValue } = parseSegment(lastSegment);

  if (filterKey !== undefined) {
    const arr = current[prop];
    if (!Array.isArray(arr)) throw new Error(`Expected array at "${prop}"`);
    const index = arr.findIndex((item: any) => String(item[filterKey]) === filterValue);
    return { parent: arr, key: index };
  }

  return { parent: current, key: prop };
}
