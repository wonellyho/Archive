import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CropRect } from "../../utils/image";
import { Button } from "../common/Button";

/** Never let the window shrink to nothing — 8% of the frame on each axis. */
const MIN_SIDE = 0.08;

type Corner = "nw" | "ne" | "sw" | "se";
type Mode = { kind: "move" } | { kind: "corner"; corner: Corner };

interface DragState {
  pointerId: number;
  mode: Mode;
  frameW: number;
  frameH: number;
  startX: number;
  startY: number;
  from: CropRect;
}

interface ImageCropperProps {
  /** The untouched original, so re-cropping never compounds losses. */
  src: string;
  onApply: (rect: CropRect) => void;
  onCancel: () => void;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/**
 * Picks the region of a photo to keep. A pin's box is whatever shape its owner
 * dragged it to, and the photo is drawn `cover` inside it — so which part of
 * the frame survives that crop is a decision worth making here, at upload,
 * rather than discovering it on the board.
 */
export function ImageCropper({ src, onApply, onCancel }: ImageCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [rect, setRect] = useState<CropRect>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });

  function begin(mode: Mode, e: ReactPointerEvent<HTMLElement>) {
    const frame = frameRef.current;
    if (!frame || e.button !== 0) return;
    const box = frame.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      mode,
      frameW: box.width,
      frameH: box.height,
      startX: e.clientX,
      startY: e.clientY,
      from: rect,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = (e.clientX - d.startX) / d.frameW;
    const dy = (e.clientY - d.startY) / d.frameH;
    const f = d.from;

    if (d.mode.kind === "move") {
      setRect({
        ...f,
        x: clamp(f.x + dx, 0, 1 - f.width),
        y: clamp(f.y + dy, 0, 1 - f.height),
      });
      return;
    }

    // Corners move the two edges they touch; the opposite two stay put.
    const west = d.mode.corner === "nw" || d.mode.corner === "sw";
    const north = d.mode.corner === "nw" || d.mode.corner === "ne";
    const right = f.x + f.width;
    const bottom = f.y + f.height;

    const x = west ? clamp(f.x + dx, 0, right - MIN_SIDE) : f.x;
    const y = north ? clamp(f.y + dy, 0, bottom - MIN_SIDE) : f.y;
    const width = west
      ? right - x
      : clamp(f.width + dx, MIN_SIDE, 1 - f.x);
    const height = north
      ? bottom - y
      : clamp(f.height + dy, MIN_SIDE, 1 - f.y);

    setRect({ x, y, width, height });
  }

  function end(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const handlers = (mode: Mode) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => begin(mode, e),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  const corners: Corner[] = ["nw", "ne", "sw", "se"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <div ref={frameRef} className="crop-frame">
          <img className="crop-image" src={src} alt="" draggable={false} />

          {/* Everything outside the window is dimmed by four bands rather than
              a hole punched through one overlay — no clip-path, no compositing
              surprises while it's being dragged. */}
          <div
            className="crop-shade"
            style={{ inset: `0 0 ${(1 - rect.y) * 100}% 0` }}
          />
          <div
            className="crop-shade"
            style={{ inset: `${(rect.y + rect.height) * 100}% 0 0 0` }}
          />
          <div
            className="crop-shade"
            style={{
              inset: `${rect.y * 100}% ${(1 - rect.x) * 100}% ${(1 - rect.y - rect.height) * 100}% 0`,
            }}
          />
          <div
            className="crop-shade"
            style={{
              inset: `${rect.y * 100}% 0 ${(1 - rect.y - rect.height) * 100}% ${(rect.x + rect.width) * 100}%`,
            }}
          />

          <div
            className="crop-window"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
            }}
            {...handlers({ kind: "move" })}
          >
            {corners.map((corner) => (
              <span
                key={corner}
                className="crop-handle"
                data-corner={corner}
                role="presentation"
                {...handlers({ kind: "corner", corner })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setRect({ x: 0, y: 0, width: 1, height: 1 })}
          className="text-sm text-ink-faint transition-colors hover:text-ink"
        >
          Reset
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onApply(rect)}>Apply crop</Button>
        </div>
      </div>
    </div>
  );
}
