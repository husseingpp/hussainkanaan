"use client";

import type { ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Props<T extends { id: string }> = {
  items: T[];
  onReorder: (items: T[]) => void;
  render: (item: T, handle: ReactNode) => ReactNode;
  layout?: "list" | "grid";
  className?: string;
  handleLabel: string;
};

/** Drag-and-drop reordering (mouse, touch and keyboard via dnd-kit). */
export function SortableList<T extends { id: string }>({ items, onReorder, render, layout = "list", className, handleLabel }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id} handleLabel={handleLabel}>
              {(handle) => render(item, handle)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, handleLabel, children }: { id: string; handleLabel: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" aria-label={handleLabel} className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-theme hover:bg-foreground/5 active:cursor-grabbing" {...attributes} {...listeners}>
      <GripVertical aria-hidden className="size-5 opacity-60" />
    </button>
  );
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "relative z-10 opacity-80 shadow-lg")}>
      {children(handle)}
    </li>
  );
}
