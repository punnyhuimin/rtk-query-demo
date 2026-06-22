export const merge = <T>(
  a: T[],
  b: T[],
  predicate: (a: T, b: T) => boolean = (a, b) => a === b
): T[] => {
  const c: T[] = [];
  a.forEach((aItem) => c.push(b.find(bItem => predicate(aItem, bItem)) ?? aItem));
  b.forEach((bItem) => (c.some((cItem) => predicate(cItem, bItem)) ? null : c.push(bItem)));
  return c;
};

export const mergeRetainDirty = <T extends { __isDirty?: boolean }>(
  a: T[],
  b: T[],
  predicate: (a: T, b: T) => boolean = (a, b) => a === b
): T[] => {
  const c: T[] = [];
  a.forEach((aItem) => {
    const newerAItem = b.find(bItem => predicate(aItem, bItem));
    c.push(aItem.__isDirty ? aItem : newerAItem!);
  });
  b.forEach((bItem) => (c.some((cItem) => predicate(cItem, bItem)) ? null : c.push(bItem)));
  return c;
};
