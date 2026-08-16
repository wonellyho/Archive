import { useCallback, useEffect, useRef, useState } from "react";
import type { Pin, PinDecoration, PinLayout } from "../../types/pin";
import { PinItem } from "./PinItem";
import { PinDetail } from "./PinDetail";

/**
 * Below this the board is too narrow to drag anything around meaningfully, so
 * it becomes a single scrapbook column instead. Matches Tailwind's `md`.
 */
const FREE_PLACEMENT_QUERY = "(min-width: 768px)";

function useFreePlacement(): boolean {
  const [free, setFree] = useState(
    () => window.matchMedia(FREE_PLACEMENT_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(FREE_PLACEMENT_QUERY);
    const sync = () => setFree(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return free;
}

interface PinboardProps {
  pins: Pin[];
  /** Owner-only: drag, resize and remove. Visitors can still open pins. */
  canEdit: boolean;
  onLayout: (id: string, layout: Partial<PinLayout>) => void;
  onRaise: (id: string) => void;
  onDecorate: (id: string, decoration: PinDecoration) => void;
  onDelete: (pin: Pin) => void;
  onAdd: () => void;
}

/**
 * The board itself: one big cork surface that drops into place, with the pins
 * wherever their owner left them. Not a grid — every position here came from
 * somebody dragging something, and the layout is the content.
 */
export function Pinboard({
  pins,
  canEdit,
  onLayout,
  onRaise,
  onDecorate,
  onDelete,
  onAdd,
}: PinboardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const free = useFreePlacement();

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  }, []);

  // Measured on demand rather than captured on click, so the detail view can
  // still fly back to the right spot if the page moved while it was open.
  const getOrigin = useCallback(() => {
    if (activeId === null) return null;
    return nodes.current.get(activeId)?.getBoundingClientRect() ?? null;
  }, [activeId]);

  const active = pins.find((pin) => pin.id === activeId) ?? null;

  return (
    <>
      <div className="pinboard-wall">
        <div
          ref={boardRef}
          className="pinboard-board"
          data-mode={free ? "free" : "flow"}
          aria-label="Memory board"
        >
          {canEdit ? (
            <button type="button" className="pinboard-add" onClick={onAdd}>
              <span aria-hidden="true">+</span>
              Add memory
            </button>
          ) : null}

          {pins.length === 0 ? (
            <p className="pinboard-empty">
              Nothing on the board yet. Pin a photo and it stays where you put it.
            </p>
          ) : null}

          {pins.map((pin, i) => (
            <PinItem
              key={pin.id}
              pin={pin}
              index={i}
              layout={free ? "free" : "flow"}
              boardRef={boardRef}
              interactive={free && canEdit}
              lifted={pin.id === activeId}
              onOpen={(p) => setActiveId(p.id)}
              onLayout={onLayout}
              onRaise={onRaise}
              onDecorate={canEdit ? onDecorate : undefined}
              onDelete={canEdit ? onDelete : undefined}
              registerRef={registerRef}
            />
          ))}
        </div>
      </div>

      {active ? (
        <PinDetail
          key={active.id}
          pin={active}
          getOrigin={getOrigin}
          onClose={() => setActiveId(null)}
        />
      ) : null}
    </>
  );
}
