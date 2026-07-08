import { useEffect } from 'react';

/**
 * Mounts a global keydown listener for Ctrl/Cmd+Z (undo) and
 * Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z (redo).
 *
 * Purely wires keyboard shortcuts to the given handlers.
 */
export function useUndoRedoShortcut(undo: () => void, redo: () => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      const key = e.key.toLowerCase();

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}
