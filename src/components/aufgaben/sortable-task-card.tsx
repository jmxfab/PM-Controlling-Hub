"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface Props {
  id: string;
  children: React.ReactNode;
}

/**
 * Drag-and-Drop Wrapper fuer TaskCards im Mein-Tag-Tab.
 * Zeigt einen kleinen Grip-Handle links neben der Karte — nur DARAUF
 * funktioniert das Draggen, der Rest der Karte bleibt klickbar
 * (Aufklappen, Buttons etc).
 */
export function SortableTaskCard({ id, children }: Props) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-1.5">
      {/* Drag-Handle: nur DAS triggert den Drag (listeners + attributes hier) */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 w-5 self-stretch grid place-items-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 rounded-md cursor-grab active:cursor-grabbing touch-none"
        title="Ziehen um zu sortieren"
        aria-label="Drag-Handle zum Sortieren"
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
