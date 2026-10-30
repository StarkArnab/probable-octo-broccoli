'use client';

import { useRef, useState, type ReactNode } from 'react';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, TraversalOrder, closestCorners, pointerWithin, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

type Item = { id: string; title: string; status: string; position: number; archived: boolean };

export function BoardDrag({ items, disabled, onMove, onError, children }: {
  items: Item[]; disabled: boolean; onMove: (id: string, status: string, position: number) => void; onError: (message: string) => void; children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const collision = useRef<Parameters<CollisionDetection>[0] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function finish({ active: dragged, over }: DragEndEvent) {
    setActive(null);
    if (disabled || !over || dragged.id === over.id) return;
    const card = items.find(c => c.id === dragged.id);
    const target = items.find(c => c.id === over.id);
    const status = target?.status ?? String(over.id);
    if (!card || !['backlog', 'todo', 'progress', 'done'].includes(status)) return;
    const destination = items.filter(c => !c.archived && c.status === status && c.id !== card.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    let index = target ? destination.findIndex(c => c.id === target.id) : destination.length;
    const pointer = collision.current?.pointerCoordinates;
    if (pointer) {
      // Use the pointer's position even when a gap/padding hits only the stack.
      // Excluding the dragged card avoids a same-column index adjustment.
      index = destination.findIndex(item => {
        const rect = collision.current?.droppableRects.get(item.id);
        return rect && pointer.y < rect.top + rect.height / 2;
      });
      if (index < 0) index = destination.length;
    } else if (target) {
      const sameColumn = card.status === status;
      const source = items.filter(c => !c.archived && c.status === card.status).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
      const after = sameColumn ? source.findIndex(c => c.id === card.id) < source.findIndex(c => c.id === target.id) : (dragged.rect.current.translated?.top ?? 0) > over.rect.top + over.rect.height / 2;
      if (after) index++;
    }
    const before = destination[index - 1]?.position;
    const after = destination[index]?.position;
    const position = before === undefined ? (after ?? 1024) - 1024 : after === undefined ? before + 1024 : before + (after - before) / 2;
    if (!Number.isFinite(position) || (before !== undefined && position <= before) || (after !== undefined && position >= after)) {
      onError('These cards have no space between their saved positions. Move the card to the start or end of the column instead.');
      return;
    }
    onMove(card.id, status, position);
  }
  return <DndContext autoScroll={{ order: TraversalOrder.ReversedTreeOrder }} sensors={sensors} collisionDetection={args => { collision.current = args; const pointer = pointerWithin(args); return pointer.length ? pointer : closestCorners(args); }} onDragStart={({ active }) => setActive(String(active.id))} onDragCancel={() => setActive(null)} onDragEnd={finish}>
    {children}
    <DragOverlay>{active && <div className="task-card drag-preview">{items.find(c => c.id === active)?.title}</div>}</DragOverlay>
  </DndContext>;
}

export function DropColumn({ id, items, children }: { id: string; items: string[]; children: ReactNode }) {
  return <section className="column" data-status={id}>
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>{children}</SortableContext>
  </section>;
}

export function DropStack({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`card-stack ${isOver ? 'drag-over' : ''}`}>{children}</div>;
}

export function SortableCard({ id, title, disabled, children }: { id: string; title: string; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return <article ref={setNodeRef} className={`task-card ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    {!disabled && <button ref={setActivatorNodeRef} className="drag-handle" {...attributes} {...listeners} aria-label={`Move ${title}`}><GripVertical size={16}/></button>}
    {children}
  </article>;
}
