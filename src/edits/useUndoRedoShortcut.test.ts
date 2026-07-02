import { renderHook } from '@testing-library/react';
import { useUndoRedoShortcut } from './useUndoRedoShortcut';
import { useHistory } from './useHistory';

jest.mock('./useHistory');

const mockUseHistory = useHistory as jest.MockedFunction<typeof useHistory>;

describe('useUndoRedoShortcut', () => {
  let undo: jest.Mock;
  let redo: jest.Mock;

  beforeEach(() => {
    undo = jest.fn();
    redo = jest.fn();
    mockUseHistory.mockReturnValue({
      undo,
      redo,
      clear: jest.fn(),
      purgeByIds: jest.fn(),
      setMaxSize: jest.fn(),
      canUndo: false,
      canRedo: false,
      pastTransactions: [],
    });
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
    renderHook(() => useUndoRedoShortcut());
    fire('z', { ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).not.toHaveBeenCalled();
  });

  it('Meta+Z calls undo (Mac)', () => {
    renderHook(() => useUndoRedoShortcut());
    fire('z', { metaKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Y calls redo', () => {
    renderHook(() => useUndoRedoShortcut());
    fire('y', { ctrlKey: true });
    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+Z calls redo', () => {
    renderHook(() => useUndoRedoShortcut());
    fire('z', { ctrlKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('ignores keys pressed without Ctrl or Meta', () => {
    renderHook(() => useUndoRedoShortcut());
    fire('z');
    fire('y');
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it('ignores unrelated Ctrl+key combinations', () => {
    renderHook(() => useUndoRedoShortcut());
    fire('a', { ctrlKey: true });
    fire('s', { ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount', () => {
    const { unmount } = renderHook(() => useUndoRedoShortcut());
    unmount();
    fire('z', { ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
  });
});
