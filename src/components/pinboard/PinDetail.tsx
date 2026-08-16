import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Pin } from "../../types/pin";
import { PinCarousel } from "./PinCarousel";

const OPEN_MS = 460;
const CLOSE_MS = 340;
const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)";

interface PinDetailProps {
  pin: Pin;
  /**
   * Reads the pin's live rect on the board. A getter rather than a captured
   * value so the close animation still lands on the pin after the page has
   * scrolled or the window has been resized.
   */
  getOrigin: () => DOMRect | null;
  onClose: () => void;
}

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Maps the card's resting rect onto the pin's rect on the board: the transform
 * that makes the enlarged card start (or finish) exactly where the pin sits.
 * Scale is uniform — matching both axes would squash photos, since the detail
 * card is a different shape from the card on the board.
 */
function flipTo(from: DOMRect, to: DOMRect, rotation: number): string {
  const scale = to.width > 0 ? from.width / to.width : 0.2;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${rotation}deg)`;
}

function monthLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The enlarged view of one memory. Rather than fading a modal in over the
 * board, the card grows out of the pin you clicked and shrinks back into it on
 * close, so the photo never loses its place on the wall.
 */
export function PinDetail({ pin, getOrigin, onClose }: PinDetailProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [shade, setShade] = useState<"in" | "out">("out");

  // The open and close animations are one gesture with a pause in between, and
  // must not restart because a prop identity changed. Latest values are read
  // through refs so both effects below can be genuinely mount-only.
  const latest = useRef({ getOrigin, onClose, rotation: pin.rotation });
  latest.current = { getOrigin, onClose, rotation: pin.rotation };

  // Grow out of the pin. Layout effect so the card is never painted at its
  // resting size for a frame before the transform lands.
  useLayoutEffect(() => {
    setShade("in");
    const el = cardRef.current;
    const from = latest.current.getOrigin();
    if (!el || !from || prefersReducedMotion()) return;

    const to = el.getBoundingClientRect();
    el.style.transition = "none";
    el.style.transform = flipTo(from, to, latest.current.rotation);
    el.style.opacity = "0.55";
    // Flush the starting style, otherwise both frames coalesce into no animation.
    void el.offsetWidth;
    el.style.transition = `transform ${OPEN_MS}ms ${EASE}, opacity 200ms ease-out`;
    el.style.transform = "none";
    el.style.opacity = "1";
  }, []);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setShade("out");

    const { getOrigin: origin, onClose: close, rotation } = latest.current;
    const el = cardRef.current;
    const from = origin();
    if (!el || !from || prefersReducedMotion()) {
      close();
      return;
    }
    const to = el.getBoundingClientRect();
    el.style.transition = `transform ${CLOSE_MS}ms ${EASE}, opacity ${CLOSE_MS}ms ease-in`;
    el.style.transform = flipTo(from, to, rotation);
    el.style.opacity = "0";
    window.setTimeout(close, CLOSE_MS);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    // The board behind must not scroll away under the open card.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [requestClose]);

  const date = monthLabel(pin.createdAt);
  const paragraphs = pin.content.split("\n").filter((line) => line.trim() !== "");

  return createPortal(
    <div
      className="pin-detail-layer"
      data-shade={shade}
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Memory"
        className="pin-detail-card"
        data-variant={pin.variant}
        onClick={(e) => e.stopPropagation()}
      >
        {pin.images.length > 0 ? (
          <PinCarousel images={pin.images} label="Memory" />
        ) : null}

        <div className="pin-detail-text">
          {paragraphs.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {date ? <span className="pin-detail-date">{date}</span> : null}
        </div>

        <button
          type="button"
          className="pin-detail-close"
          aria-label="Close"
          onClick={requestClose}
        >
          ✕
        </button>
      </div>
    </div>,
    document.body,
  );
}
