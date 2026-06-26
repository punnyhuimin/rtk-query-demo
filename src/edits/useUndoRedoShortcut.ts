import { useEffect } from 'react';
import { useHistory } from './useHistory';

/**
 * Mounts a global keydown listener for Ctrl/Cmd+Z (undo) and
 * Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z (redo).
 *
 * Call once at the top of the component tree (e.g. in App).
 */
export function useUndoRedoShortcut(): void {
  const { undo, redo } = useHistory();

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
