import { resolvePath } from './resolvePath';

const entity = { id: 'a', name: 'Alpha', score: 10 };
const nested = { id: 'a', location: { lat: 1, lng: 2 } };

describe('resolvePath', () => {
  describe('plain object key (no id segment)', () => {
    it('resolves a top-level key on a plain object', () => {
      const { parent, key } = resolvePath(entity, 'name');
      expect(parent).toBe(entity);
      expect(key).toBe('name');
    });
  });

  describe('[id=<x>] segment on an array', () => {
    it('returns the matching element as parent with the final plain key', () => {
      const arr = [entity];
      const { parent, key } = resolvePath(arr, '[id=a]/name');
      expect(parent).toBe(entity);
      expect(key).toBe('name');
    });

    it('returns the array and index when the last segment is an id selector', () => {
      const arr = [entity];
      const { parent, key } = resolvePath(arr, '[id=a]');
      expect(parent).toBe(arr);
      expect(key).toBe(0);
    });

    it('returns key -1 when no element matches the id', () => {
      const arr = [entity];
      const { parent, key } = resolvePath(arr, '[id=missing]');
      expect(key).toBe(-1);
    });
  });

  describe('deeply nested paths', () => {
    it('traverses multiple segments to reach the final key', () => {
      const arr = [nested];
      const { parent, key } = resolvePath(arr, '[id=a]/location/lat');
      expect(parent).toBe(nested.location);
      expect(key).toBe('lat');
    });
  });

  describe('missing intermediate nodes', () => {
    it('returns an empty parent and empty-string key when an intermediate segment is null', () => {
      const arr = [{ id: 'a', location: null }];
      const { parent, key } = resolvePath(arr, '[id=a]/location/lat');
      expect(key).toBe('');
    });
  });
});
