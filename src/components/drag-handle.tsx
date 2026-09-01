"use client";

/**
 * Narrow grab column, as the original app's `.drag-col` was.
 *
 * The handle is the draggable element rather than the whole row: rows here are
 * mostly text inputs, and making those draggable breaks click-to-position and
 * text selection inside them.
 */
export function DragHandle({
  onDragStart,
  onDragEnd,
  label,
}: {
  onDragStart: () => void;
  onDragEnd: () => void;
  label: string;
}) {
  return (
    <td className="w-7 px-0 text-center align-middle">
      <span
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        role="button"
        tabIndex={-1}
        aria-label={label}
        title="Drag to reorder"
        className="inline-block cursor-grab px-1 leading-none text-fg-dim/50 select-none hover:text-fg-dim active:cursor-grabbing"
      >
        ⠿
      </span>
    </td>
  );
}

/** Reorders `list` by moving the item at `from` to `to`. */
export function applyMove<T>(list: T[], { from, to }: { from: number; to: number }): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface Move {
  from: number;
  to: number;
}
