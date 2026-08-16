import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { Pin, PinDecoration as Decoration, PinLayout } from "../../types/pin";
import {
  BOARD_REF_WIDTH,
  DECORATIONS,
  MAX_PIN_WIDTH,
  MIN_PIN_WIDTH,
} from "../../types/pin";
import { PinDecoration, PinDecorationSwatch } from "./PinDecoration";

/** Movement below this is a click, not a drag — fingers are never still. */
const DRAG_THRESHOLD = 4;

/** Turning back to roughly square snaps to exactly square. */
const ROTATE_SNAP_DEG = 3;

const DECORATION_LABEL: Record<Decoration, string> = {
  none: "Bare",
  pin: "Tack",
  tape: "Tape",
};

interface DragState {
  mode: "move" | "resize" | "rotate";
  pointerId: number;
  startX: number;
  startY: number;
  boardW: number;
  boardH: number;
  /** Layout at the moment the gesture began. */
  fromX: number;
  fromY: number;
  fromW: number;
  fromH: number;
  fromRotation: number;
  /** Pin centre in client coords, and the angle to it — for rotation. */
  centreX: number;
  centreY: number;
  startAngle: number;
  /** Rendered size in CSS px, for keeping the pin inside the board. */
  elW: number;
  elH: number;
  moved: boolean;
}

interface PinItemProps {
  pin: Pin;
  boardRef: RefObject<HTMLDivElement | null>;
  /**
   * `free` honours the pin's saved coordinates; `flow` drops it into a single
   * scrapbook column, which is what small screens get instead of a canvas too
   * cramped to drag things around on.
   */
  layout: "free" | "flow";
  /** Position in the stack — only used to stagger the entrance. */
  index: number;
  /** Free placement is on: desktop/tablet, and the viewer owns the board. */
  interactive: boolean;
  /** True while this pin's detail view is open — it's shown enlarged instead. */
  lifted: boolean;
  onOpen: (pin: Pin) => void;
  onLayout: (id: string, layout: Partial<PinLayout>) => void;
  onRaise: (id: string) => void;
  onDecorate?: (id: string, decoration: Decoration) => void;
  onDelete?: (pin: Pin) => void;
  /** Lets the board re-measure this pin later, to animate the detail back into it. */
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/**
 * One memory on the board: a photo (or a note) that its owner can drag, resize
 * and turn. Positions live in board percentages and sizes in the board's
 * reference space, so a layout set on a laptop still looks right on a wider
 * screen (see types/pin.ts).
 */
export function PinItem({
  pin,
  boardRef,
  layout,
  index,
  interactive,
  lifted,
  onOpen,
  onLayout,
  onRaise,
  onDecorate,
  onDelete,
  registerRef,
}: PinItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  // A drag ends with a pointerup over the card, which the browser then turns
  // into a click; this stops that click from opening the detail view.
  const swallowClick = useRef(false);
  const [gesture, setGesture] = useState<DragState["mode"] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const cover = pin.images[0];
  const stacked = pin.images.length > 1;

  // Stable so the board's node map isn't torn down and rebuilt on every
  // pointermove of a drag.
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      registerRef(pin.id, el);
    },
    [registerRef, pin.id],
  );

  // The picker is a bare popover, so it has to close itself on any click that
  // isn't inside it.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    // pointerdown, not mousedown, so a tap outside closes it on touch too.
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function begin(mode: DragState["mode"], e: ReactPointerEvent<HTMLElement>) {
    if (!interactive || e.button !== 0) return;
    const board = boardRef.current;
    const el = ref.current;
    if (!board || !el) return;
    const boardRect = board.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const centreX = elRect.left + elRect.width / 2;
    const centreY = elRect.top + elRect.height / 2;
    drag.current = {
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      boardW: boardRect.width,
      boardH: boardRect.height,
      fromX: pin.x,
      fromY: pin.y,
      fromW: pin.width,
      fromH: pin.height,
      fromRotation: pin.rotation,
      centreX,
      centreY,
      startAngle: Math.atan2(e.clientY - centreY, e.clientX - centreX),
      elW: elRect.width,
      elH: elRect.height,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      setGesture(d.mode);
    }

    if (d.mode === "move") {
      onLayout(pin.id, {
        x: clamp(d.fromX + (dx / d.boardW) * 100, 0, 100 - (d.elW / d.boardW) * 100),
        y: clamp(d.fromY + (dy / d.boardH) * 100, 0, 100 - (d.elH / d.boardH) * 100),
      });
      return;
    }

    if (d.mode === "rotate") {
      // The angle swept around the pin's centre since the handle was grabbed.
      const angle = Math.atan2(e.clientY - d.centreY, e.clientX - d.centreX);
      const degrees = d.fromRotation + ((angle - d.startAngle) * 180) / Math.PI;
      const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
      onLayout(pin.id, {
        rotation:
          Math.abs(wrapped) < ROTATE_SNAP_DEG ? 0 : Math.round(wrapped * 10) / 10,
      });
      return;
    }

    // Resize pulls the bottom-right corner. Aspect ratio is preserved so photos
    // never stretch, and the pin can't grow past the board's right edge.
    const toRef = BOARD_REF_WIDTH / d.boardW;
    const roomRight = ((100 - pin.x) / 100) * BOARD_REF_WIDTH;
    const width = clamp(
      d.fromW + dx * toRef,
      MIN_PIN_WIDTH,
      Math.min(MAX_PIN_WIDTH, roomRight),
    );
    onLayout(pin.id, {
      width: Math.round(width),
      height: Math.round(width * (d.fromH / d.fromW)),
    });
  }

  function end(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    setGesture(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (d.moved) {
      swallowClick.current = true;
      // Whatever you just handled ends up on top of the stack.
      onRaise(pin.id);
    }
  }

  function open() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    onOpen(pin);
  }

  /** Handles share these; each one captures the pointer on itself. */
  const handleProps = (mode: DragState["mode"]) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => begin(mode, e),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  return (
    <div
      ref={attach}
      className="pin-item"
      data-layout={layout}
      data-variant={pin.variant}
      data-gesture={gesture ?? undefined}
      data-lifted={lifted || undefined}
      data-interactive={interactive || undefined}
      data-menu={menuOpen || undefined}
      style={
        {
          ...(layout === "free"
            ? {
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                width: `${(pin.width / BOARD_REF_WIDTH) * 100}%`,
                zIndex: pin.z,
              }
            : null),
          aspectRatio: `${pin.width} / ${pin.height}`,
          "--pin-rotate": `${pin.rotation}deg`,
          "--pin-index": index,
        } as CSSProperties
      }
      {...handleProps("move")}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={
          pin.variant === "memo"
            ? `Note: ${pin.content.slice(0, 40)}`
            : `Memory with ${pin.images.length} photo(s)`
        }
        className="pin-card"
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(pin);
          }
        }}
      >
        {cover ? (
          <img className="pin-photo" src={cover} alt="" draggable={false} />
        ) : (
          <p className="pin-memo-text">{pin.content}</p>
        )}

        {stacked ? (
          <span className="pin-count" aria-hidden="true">
            {pin.images.length}
          </span>
        ) : null}
      </div>

      <PinDecoration kind={pin.decoration} />

      {interactive ? (
        <>
          <span
            className="pin-handle"
            data-handle="rotate"
            role="presentation"
            title="Drag to turn"
            {...handleProps("rotate")}
          />
          <span
            className="pin-handle"
            data-handle="resize"
            role="presentation"
            title="Drag to resize"
            {...handleProps("resize")}
          />

          {onDecorate ? (
            <button
              type="button"
              className="pin-handle"
              data-handle="decorate"
              aria-label="Change how this is stuck up"
              aria-expanded={menuOpen}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            />
          ) : null}

          {menuOpen && onDecorate ? (
            <div
              className="pin-menu"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {DECORATIONS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="pin-menu-item"
                  data-active={pin.decoration === kind || undefined}
                  onClick={() => {
                    onDecorate(pin.id, kind);
                    setMenuOpen(false);
                  }}
                >
                  <PinDecorationSwatch kind={kind} />
                  {DECORATION_LABEL[kind]}
                </button>
              ))}
              {onDelete ? (
                <button
                  type="button"
                  className="pin-menu-item"
                  data-danger="true"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(pin);
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
