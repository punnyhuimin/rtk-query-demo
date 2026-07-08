import { renderHook } from '@testing-library/react';
import { useUndoRedoShortcut } from './useUndoRedoShortcut';

describe('useUndoRedoShortcut', () => {
  let undo: jest.Mock;
  let redo: jest.Mock;

  beforeEach(() => {
    undo = jest.fn();
    redo = jest.fn();
  });

  const fire = (
    key: string,
    mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {},
  ) => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        ctrlKey: mods.ctrlKey ?? false,
        metaKey: mods.metaKey ?? false,
        shiftKey: mods.shiftKey ?? false,
        bubbles: true,
        cancelable: true,
      }),
    );
  };

  it('Ctrl+Z calls undo', () => {
    renderHook(() => useUndoRedoShortcut(undo, redo));
    fire('z', { ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).not.toHaveBeenCalled();
  });

  it('Meta+Z calls undo (Mac)', () => {
    renderHook(() => useUndoRedoShortcut(undo, redo));
    fire('z', { metaKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Y calls redo', () => {
    renderHook(() => useUndoRedoShortcut(undo, redo));
    fire('y', { ctrlKey: true });
    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+Z calls redo', () => {
    renderHook(() => useUndoRedoShortcut(undo, redo));
    fire('z', { ctrlKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('ignores keys pressed without Ctrl or Meta', () => {
    renderHook(() => useUndoRedoShortcut(undo, redo));
    fire('z');
    fire('y');
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it('ignores unrelated Ctrl+key combinations', () => {
    renderHook(() => useUndoRedoShortcut(undo, redo));
    fire('a', { ctrlKey: true });
    fire('s', { ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount', () => {
    const { unmount } = renderHook(() => useUndoRedoShortcut(undo, redo));
    unmount();
    fire('z', { ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
  });
});
