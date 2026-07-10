import { useLayoutEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { TasteContent } from "../../types/content";
import { EmptyState } from "./EmptyState";

interface ContentListProps {
  contents: TasteContent[];
  selectedContentId: string | null;
  onSelect: (content: TasteContent) => void;
  onEdit: (content: TasteContent) => void;
  onDelete: (content: TasteContent) => void;
  /** Persist a new card order (edit mode only). */
  onReorder?: (orderedIds: string[]) => void;
  label: string;
  emptyTitle: string;
  /** Drives the staggered entrance animation when the folder opens. */
  open: boolean;
  /** When false, edit/delete controls are hidden (visitors). */
  canEdit: boolean;
}

const iconButton =
  "rounded-full bg-paper/90 p-2 text-sm shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function moveId(list: string[], fromId: string, toId: string): string[] {
  const from = list.indexOf(fromId);
  const to = list.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Responsive card grid: thumbnail, then user title / subtitle (shared font). */
export function ContentList({
  contents,
  selectedContentId,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
  label,
  emptyTitle,
  open,
  canEdit,
}: ContentListProps) {
  const draggable = canEdit && onReorder !== undefined;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  // True once a drag begins, so the trailing click doesn't open the card.
  const draggedRef = useRef(false);
  // FLIP: remember each card's position so it can glide to its new slot.
  const nodeRefs = useRef(new Map<string, HTMLLIElement>());
  const prevRects = useRef(new Map<string, DOMRect>());
  const orderSigRef = useRef("");

  useLayoutEffect(() => {
    // Only touch layout when the order actually changes — playback ticks
    // re-render this list several times a second and we must not thrash then.
    const sig = (dragOrder ?? contents.map((c) => c.id)).join("|");
    if (sig === orderSigRef.current) return;

    const next = new Map<string, DOMRect>();
    nodeRefs.current.forEach((el, id) => next.set(id, el.getBoundingClientRect()));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      next.forEach((rect, id) => {
        if (id === draggingId) return; // the dragged card follows the cursor
        const old = prevRects.current.get(id);
        const el = nodeRefs.current.get(id);
        if (!old || !el) return;
        const dx = old.left - rect.left;
        const dy = old.top - rect.top;
        if (dx === 0 && dy === 0) return;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)";
          el.style.transform = "";
        });
      });
    }
    prevRects.current = next;
    orderSigRef.current = sig;
  });

  if (contents.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        hint={canEdit ? "검색해서 콘텐츠를 추가해 보세요." : undefined}
      />
    );
  }

  const baseIds = contents.map((c) => c.id);
  const orderIds = dragOrder ?? baseIds;
  const byId = new Map(contents.map((c) => [c.id, c]));
  const ordered = orderIds
    .map((id) => byId.get(id))
    .filter((c): c is TasteContent => c !== undefined);

  function handleDragStart(event: DragEvent<HTMLLIElement>, id: string) {
    draggedRef.current = true;
    setDraggingId(id);
    setDragOrder(baseIds);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, overId: string) {
    if (draggingId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overId === draggingId) return;
    setDragOrder((prev) => moveId(prev ?? baseIds, draggingId, overId));
  }

  function handleDragEnd() {
    if (dragOrder && !sameOrder(dragOrder, baseIds)) {
      onReorder?.(dragOrder);
    }
    setDraggingId(null);
    setDragOrder(null);
  }

  return (
    <ul
      aria-label={label}
      data-open={open}
      className="cascade grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {ordered.map((content, index) => {
        const selected = content.id === selectedContentId;
        const isDragging = content.id === draggingId;
        return (
          <li
            key={content.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(content.id, el);
              else nodeRefs.current.delete(content.id);
            }}
            draggable={draggable}
            onPointerDown={
              draggable ? () => (draggedRef.current = false) : undefined
            }
            onDragStart={
              draggable
                ? (event) => handleDragStart(event, content.id)
                : undefined
            }
            onDragOver={
              draggable
                ? (event) => handleDragOver(event, content.id)
                : undefined
            }
            onDrop={draggable ? (event) => event.preventDefault() : undefined}
            onDragEnd={draggable ? handleDragEnd : undefined}
            className={`relative transition-opacity ${
              draggable ? "cursor-grab active:cursor-grabbing" : ""
            } ${isDragging ? "opacity-40" : ""}`}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => {
                if (draggedRef.current) {
                  draggedRef.current = false;
                  return;
                }
                onSelect(content);
              }}
              className={`group flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-paper text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? "border-accent shadow-md"
                  : "border-line hover:border-ink/30"
              }`}
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-cream-deep">
                <img
                  src={content.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="flex flex-1 flex-col gap-1 p-4 font-serif">
                <span className="line-clamp-2 text-lg font-medium text-ink">
                  {content.title || content.sourceTitle}
                </span>
                {content.subtitle ? (
                  <span className="line-clamp-1 text-base text-ink-faint">
                    {content.subtitle}
                  </span>
                ) : null}
              </span>
            </button>

            {canEdit ? (
              <div className="absolute right-2 top-2 z-10 flex gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(content)}
                  aria-label={`${content.title || content.sourceTitle} 편집`}
                  className={`${iconButton} text-ink-soft hover:bg-paper hover:text-ink`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(content)}
                  aria-label={`${content.title || content.sourceTitle} 삭제`}
                  className={`${iconButton} text-ink-faint hover:bg-accent-soft hover:text-accent`}
                >
                  🗑
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
