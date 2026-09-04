'use client';

import { useRef, useState, type DragEvent } from 'react';

/**
 * Native HTML5 drag-and-drop for an ordered list.
 *
 * Kept alongside the existing up/down buttons rather than replacing them: dragging
 * is faster with a mouse, but it is unreachable by keyboard, and reordering a
 * curriculum is exactly the kind of thing people do from a laptop on a train.
 *
 * `scope` isolates concurrent lists — dragging a video out of chapter 1 must not
 * drop into chapter 2, whose items are a different sequence in a different table.
 */
export function useDragReorder({
  onReorder,
}: {
  onReorder: (from: number, to: number, scope: string) => void | Promise<void>;
}) {
  const dragged = useRef<{ index: number; scope: string } | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [activeScope, setActiveScope] = useState<string | null>(null);

  const handlers = (index: number, scope: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      dragged.current = { index, scope };
      setActiveScope(scope);
      event.dataTransfer.effectAllowed = 'move';
      // Firefox refuses to start a drag without payload.
      try {
        event.dataTransfer.setData('text/plain', String(index));
      } catch {
        /* older browsers throw on unsupported types */
      }
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const source = dragged.current;
      if (!source || source.scope !== scope) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setOverIndex(index);
    },
    onDragLeave: () => {
      setOverIndex((current) => (current === index ? null : current));
    },
    onDrop: async (event: DragEvent<HTMLElement>) => {
      const source = dragged.current;
      dragged.current = null;
      setOverIndex(null);
      setActiveScope(null);
      if (!source || source.scope !== scope) return;
      event.preventDefault();
      if (source.index === index) return;
      await onReorder(source.index, index, scope);
    },
    onDragEnd: () => {
      dragged.current = null;
      setOverIndex(null);
      setActiveScope(null);
    },
    'data-dragging': dragged.current?.index === index && dragged.current.scope === scope,
    'data-dragover': overIndex === index && activeScope === scope,
  });

  return { handlers, overIndex, activeScope };
}

/** Move one entry, returning a new array. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
