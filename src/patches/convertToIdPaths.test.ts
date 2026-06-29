import { convertToIdPaths } from './convertToIdPaths';
import type { FieldEdit } from 'types/CacheDiff';

type E = { id: string; name?: string; score?: number; extra?: string };

const e = (id: string, rest: Omit<E, 'id'> = {}): E => ({ id, ...rest });

describe('convertToIdPaths', () => {
  describe('no changes', () => {
    it('returns an empty array when before and after are the same reference', () => {
      const arr = [e('1', { name: 'a' })];
      expect(convertToIdPaths(arr, arr)).toEqual([]);
    });

    it('returns an empty array when before and after have the same entities by reference', () => {
      const item = e('1', { name: 'a' });
      expect(convertToIdPaths([item], [item])).toEqual([]);
    });
  });

  describe('entity removal', () => {
    it('emits a remove edit with the original index', () => {
      const before = [e('1'), e('2'), e('3')];
      const after  = [e('1'), e('3')];
      const edits = convertToIdPaths(before, after);
      expect(edits).toHaveLength(1);
      expect(edits[0]).toMatchObject<Partial<FieldEdit>>({
        path: '[id=2]',
        op: 'remove',
        before: e('2'),
        after: undefined,
        index: 1,
      });
    });

    it('records the correct index for each of multiple removals', () => {
      const before = [e('1'), e('2'), e('3')];
      const after: E[] = [];
      const edits = convertToIdPaths(before, after);
      expect(edits.map(ed => ed.index)).toEqual([0, 1, 2]);
    });
  });

  describe('entity addition', () => {
    it('emits an add edit with the index in the after array', () => {
      const before: E[] = [];
      const after  = [e('new')];
      const edits = convertToIdPaths(before, after);
      expect(edits).toHaveLength(1);
      expect(edits[0]).toMatchObject<Partial<FieldEdit>>({
        path: '[id=new]',
        op: 'add',
        before: undefined,
        after: e('new'),
        index: 0,
      });
    });

    it('records the correct index for each of multiple additions', () => {
      // entity '1' stays; '2' lands at index 1, '3' at index 2 in after
      const shared = e('1');
      const before = [shared];
      const after  = [shared, e('2'), e('3')];
      const edits = convertToIdPaths(before, after);
      expect(edits.map(ed => ed.index)).toEqual([1, 2]);
    });
  });

  describe('field-level changes', () => {
    it('emits a replace edit for a changed field', () => {
      const before = [e('1', { name: 'Old' })];
      const after  = [{ ...before[0], name: 'New' }]; // new reference, changed name
      const edits = convertToIdPaths(before, after);
      expect(edits).toHaveLength(1);
      expect(edits[0]).toMatchObject<Partial<FieldEdit>>({
        path: '[id=1]/name',
        op: 'replace',
        before: 'Old',
        after: 'New',
      });
    });

    it('emits an add edit when a new field is introduced', () => {
      const before = [e('1', { name: 'x' })];
      const after  = [{ ...before[0], extra: 'added' }];
      const edits = convertToIdPaths(before, after);
      const addEdit = edits.find(ed => ed.path === '[id=1]/extra');
      expect(addEdit?.op).toBe('add');
      expect(addEdit?.after).toBe('added');
    });

    it('emits a remove edit when a field is deleted', () => {
      const before = [e('1', { name: 'x', score: 5 })];
      const after  = [{ id: '1', name: 'x' }] as E[]; // score removed
      const edits = convertToIdPaths(before, after);
      const removeEdit = edits.find(ed => ed.path === '[id=1]/score');
      expect(removeEdit?.op).toBe('remove');
    });

    it('emits one edit per changed field when multiple fields differ', () => {
      const before = [e('1', { name: 'Old', score: 1 })];
      const after  = [{ ...before[0], name: 'New', score: 2 }];
      const edits = convertToIdPaths(before, after);
      const paths = edits.map(ed => ed.path);
      expect(paths).toContain('[id=1]/name');
      expect(paths).toContain('[id=1]/score');
    });
  });

  describe('mixed operations', () => {
    it('handles additions, removals, and field edits in the same diff', () => {
      const before = [e('1', { name: 'Keep' }), e('2', { name: 'Remove' })];
      const after  = [{ ...before[0], name: 'Changed' }, e('3', { name: 'New' })];
      const edits = convertToIdPaths(before, after);

      expect(edits.some(ed => ed.path === '[id=2]' && ed.op === 'remove')).toBe(true);
      expect(edits.some(ed => ed.path === '[id=1]/name' && ed.op === 'replace')).toBe(true);
      expect(edits.some(ed => ed.path === '[id=3]' && ed.op === 'add')).toBe(true);
    });
  });

  describe('unchanged entities are not emitted', () => {
    it('skips entities whose reference did not change', () => {
      const unchanged = e('1', { name: 'Same' });
      const changed   = e('2', { name: 'Old' });
      const before = [unchanged, changed];
      const after  = [unchanged, { ...changed, name: 'New' }];
      const edits = convertToIdPaths(before, after);
      expect(edits.every(ed => ed.path.startsWith('[id=2]'))).toBe(true);
    });
  });
});
