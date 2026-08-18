import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";

/** How far a swipe must travel before it counts as "next"/"previous". */
const SWIPE_THRESHOLD = 48;

interface PinCarouselProps {
  images: string[];
  /** Announced to screen readers as the album's name. */
  label: string;
}

/**
 * The image strip inside the detail view: arrows, dots, an `n / total`
 * counter, arrow keys, and swipe. Behaves the same on every screen size —
 * the board's layout simplifies on mobile, this doesn't.
 */
export function PinCarousel({ images, label }: PinCarouselProps) {
  const [index, setIndex] = useState(0);
  const [orientation, setOrientation] = useState<Record<number, "landscape" | "portrait">>({});
  const [ratio, setRatio] = useState<Record<number, number>>({});
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const swipe = useRef<{ pointerId: number; startX: number } | null>(null);
  const total = images.length;
  const activeOrientation = orientation[index] ?? "landscape";
  const activeRatio = ratio[index] ?? (activeOrientation === "portrait" ? 0.75 : 1.33);
  const detailHeight = Math.min(viewport.height * 0.88, 940);
  const portraitWidth =
    activeOrientation === "portrait"
      ? Math.max(
          120,
          Math.min(
            Math.round(detailHeight * activeRatio),
            Math.round(viewport.width * 0.96 - Math.min(viewport.width * 0.38, 620)),
          ),
        )
      : undefined;

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => {
        const next = current + delta;
        // Stop at the ends rather than wrapping: a memory has a first and last
        // photo, and silently looping makes it unclear where you are.
        return Math.min(Math.max(next, 0), total - 1);
      });
    },
    [total],
  );

  useEffect(() => {
    if (total < 2) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  useEffect(() => {
    function syncViewport() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  function startSwipe(e: ReactPointerEvent<HTMLDivElement>) {
    if (total < 2) return;
    swipe.current = { pointerId: e.pointerId, startX: e.clientX };
  }

  function endSwipe(e: ReactPointerEvent<HTMLDivElement>) {
    const s = swipe.current;
    if (!s || s.pointerId !== e.pointerId) return;
    swipe.current = null;
    const dx = e.clientX - s.startX;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1);
  }

  if (total === 0) return null;

  return (
    <div
      className="pin-carousel"
      data-orientation={activeOrientation}
      style={
        {
          "--active-image-ratio": activeRatio,
          "--portrait-image-width": portraitWidth
            ? `${portraitWidth}px`
            : undefined,
        } as CSSProperties
      }
    >
      <div
        className="pin-carousel-frame"
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        onPointerDown={startSwipe}
        onPointerUp={endSwipe}
        onPointerCancel={() => (swipe.current = null)}
      >
        <div
          className="pin-carousel-track"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {images.map((src, i) => (
            <div key={src.slice(0, 64) + i} className="pin-carousel-slide">
              <img
                className="pin-carousel-image"
                data-orientation={orientation[i] ?? undefined}
                src={src}
                alt={`${label} — ${i + 1} of ${total}`}
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const next =
                    img.naturalHeight > img.naturalWidth ? "portrait" : "landscape";
                  setOrientation((current) =>
                    current[i] === next ? current : { ...current, [i]: next },
                  );
                  const nextRatio = img.naturalWidth / img.naturalHeight;
                  setRatio((current) =>
                    current[i] === nextRatio ? current : { ...current, [i]: nextRatio },
                  );
                }}
              />
            </div>
          ))}
        </div>

        {total > 1 ? (
          <>
            <button
              type="button"
              className="pin-carousel-arrow"
              data-side="prev"
              aria-label="Previous image"
              disabled={index === 0}
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="pin-carousel-arrow"
              data-side="next"
              aria-label="Next image"
              disabled={index === total - 1}
              onClick={() => go(1)}
            >
              ›
            </button>
            <span className="pin-carousel-counter">
              {index + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="pin-carousel-dots">
          {images.map((src, i) => (
            <button
              key={src.slice(0, 64) + i}
              type="button"
              className="pin-carousel-dot"
              data-active={i === index || undefined}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
