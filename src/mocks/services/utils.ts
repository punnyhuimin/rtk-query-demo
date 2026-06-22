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
