import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type {
  BoardSettings,
  Pin,
  PinColor,
  PinDecoration,
  PinLayout,
} from "../../types/pin";
import {
  MAX_BOARD_ASPECT,
  MIN_BOARD_ASPECT,
  MIN_BOARD_WIDTH_PCT,
} from "../../types/pin";
import { PinItem } from "./PinItem";
import { PinDetail } from "./PinDetail";

/**
 * Below this the board is too narrow to drag anything around meaningfully, so
 * it becomes a single scrapbook column instead. Matches Tailwind's `md`.
 */
const FREE_PLACEMENT_QUERY = "(min-width: 768px)";

type BoardGesture = "width" | "height" | "both";

interface BoardDrag {
  pointerId: number;
  mode: BoardGesture;
  startX: number;
  startY: number;
  /** Space the board is allowed to fill, and its size when the drag began. */
  availableW: number;
  fromWidthPct: number;
  fromW: number;
  fromH: number;
}

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

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

interface PinboardProps {
  pins: Pin[];
  board: BoardSettings;
  /** Owner-only: drag, resize and remove. Visitors can still open pins. */
  canEdit: boolean;
  onLayout: (id: string, layout: Partial<PinLayout>) => void;
  onRaise: (id: string) => void;
  onDecorate: (id: string, decoration: PinDecoration) => void;
  onPinColor: (id: string, color: PinColor) => void;
  onEdit: (pin: Pin) => void;
  onDelete: (pin: Pin) => void;
  onBoard: (patch: Partial<BoardSettings>) => void;
  onAdd: () => void;
}

/**
 * The board itself: one big pane that drops into place, with the pins wherever
 * their owner left them. Not a grid — every position here came from somebody
 * dragging something, and the layout is the content. The pane's own width,
 * height and tint are the owner's to set too.
 */
export function Pinboard({
  pins,
  board,
  canEdit,
  onLayout,
  onRaise,
  onDecorate,
  onPinColor,
  onEdit,
  onDelete,
  onBoard,
  onAdd,
}: PinboardProps) {
  const wallRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<BoardDrag | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sizing, setSizing] = useState<BoardGesture | null>(null);
  const [tuning, setTuning] = useState(false);
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

  function beginResize(mode: BoardGesture, e: ReactPointerEvent<HTMLElement>) {
    const wall = wallRef.current;
    const el = boardRef.current;
    if (!wall || !el || e.button !== 0) return;
    const box = el.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      availableW: wall.getBoundingClientRect().width,
      fromWidthPct: board.widthPct,
      fromW: box.width,
      fromH: box.height,
    };
    setSizing(mode);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function resize(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const patch: Partial<BoardSettings> = {};

    if (d.mode !== "height") {
      // The board is centred, so its right edge only moves half as far as the
      // width grows — double the delta to keep the edge under the cursor.
      const dx = ((e.clientX - d.startX) * 2) / d.availableW;
      patch.widthPct = clamp(
        d.fromWidthPct + dx * 100,
        MIN_BOARD_WIDTH_PCT,
        100,
      );
    }
    if (d.mode !== "width") {
      const height = Math.max(160, d.fromH + (e.clientY - d.startY));
      // Height is stored as a ratio, not pixels, so it survives a resize of
      // the window as well as a move to another screen.
      const width = (patch.widthPct ?? d.fromWidthPct) * (d.availableW / 100);
      patch.aspect = clamp(width / height, MIN_BOARD_ASPECT, MAX_BOARD_ASPECT);
    }
    onBoard(patch);
  }

  function endResize(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    setSizing(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const grip = (mode: BoardGesture) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => beginResize(mode, e),
    onPointerMove: resize,
    onPointerUp: endResize,
    onPointerCancel: endResize,
  });

  return (
    <>
      <div className="pinboard-wall" ref={wallRef}>
        <div
          ref={boardRef}
          className="pinboard-board"
          data-mode={free ? "free" : "flow"}
          data-sizing={sizing ?? undefined}
          aria-label="Memory board"
          style={
            {
              "--board-alpha": board.opacity / 100,
              ...(free
                ? {
                    width: `${board.widthPct}%`,
                    aspectRatio: board.aspect,
                  }
                : null),
            } as CSSProperties
          }
        >
          {canEdit ? (
            <div className="pinboard-tools">
              <div className="pinboard-tool-wrap">
                <button
                  type="button"
                  className="pinboard-tool"
                  aria-label="Opacity"
                  aria-expanded={tuning}
                  onClick={() => setTuning((v) => !v)}
                >
                  ◐
                </button>
                {tuning ? (
                  <div className="pinboard-popover">
                    <label className="pinboard-slider">
                      <span>Opacity</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(board.opacity)}
                        onChange={(e) =>
                          onBoard({ opacity: Number(e.target.value) })
                        }
                        className="accent-accent"
                        aria-label="Opacity"
                      />
                      <output>{Math.round(board.opacity)}%</output>
                    </label>
                  </div>
                ) : null}
              </div>

              <button type="button" className="pinboard-add" onClick={onAdd}>
                <span aria-hidden="true">+</span>
                Add memory
              </button>
            </div>
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
              onPinColor={canEdit ? onPinColor : undefined}
              onEdit={canEdit ? onEdit : undefined}
              onDelete={canEdit ? onDelete : undefined}
              registerRef={registerRef}
            />
          ))}

          {/* Edge grips for the board itself: right for width, bottom for
              height, corner for both. Only where free placement applies. */}
          {free && canEdit ? (
            <>
              <span
                className="board-grip"
                data-grip="width"
                role="presentation"
                title="Drag to change the board's width"
                {...grip("width")}
              />
              <span
                className="board-grip"
                data-grip="height"
                role="presentation"
                title="Drag to change the board's height"
                {...grip("height")}
              />
              <span
                className="board-grip"
                data-grip="both"
                role="presentation"
                title="Drag to resize the board"
                {...grip("both")}
              />
            </>
          ) : null}
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
