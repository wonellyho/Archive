import { useLayoutEffect, useRef } from "react";
import { useVideo } from "../../context/videoContext";
import { youtubeEmbedUrl } from "../../utils/youtube";

/**
 * The one persistent video surface. Docks over the inline TV screen when an
 * anchor is set, otherwise floats in the bottom-right dock. It only holds a live
 * iframe while video is the active medium; when music takes over it shows a
 * stopped thumbnail card (click to resume), so playback never overlaps.
 */
export function FloatingVideo() {
  const { watching, active, anchor, watch, stop } = useVideo();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const docked = anchor !== null;

  // Docked: glue the fixed wrapper to the inline screen (follows scroll/resize).
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!docked || anchor === null) {
      el.style.top = "";
      el.style.left = "";
      el.style.width = "";
      el.style.height = "";
      return;
    }
    let raf = 0;
    const sync = () => {
      const r = anchor.getBoundingClientRect();
      el.style.top = `${r.top}px`;
      el.style.left = `${r.left}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      raf = requestAnimationFrame(sync);
    };
    sync();
    return () => cancelAnimationFrame(raf);
  }, [docked, anchor]);

  if (watching === null) return null;

  const playing = active === "video";
  const title = watching.title || watching.sourceTitle;

  return (
    <div
      ref={wrapperRef}
      className={docked ? "fixed z-30" : "mini-player group w-full"}
    >
      <div
        className={
          docked
            ? "h-full w-full overflow-hidden rounded-2xl"
            : "overflow-hidden rounded-2xl border border-line bg-paper/95 shadow-xl backdrop-blur"
        }
      >
        <div
          className={`relative w-full overflow-hidden bg-black ${
            docked ? "h-full" : "aspect-video"
          }`}
        >
          {playing ? (
            <iframe
              key={watching.id}
              className="absolute inset-0 h-full w-full"
              src={youtubeEmbedUrl(watching.youtubeVideoId, { autoplay: 1 })}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => watch(watching)}
              aria-label="영상 이어서 재생"
              className="group/play absolute inset-0"
            >
              <img
                src={watching.thumbnailUrl}
                alt=""
                className="size-full object-cover opacity-80 transition-opacity group-hover/play:opacity-100"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-ink/60 text-lg text-paper transition-transform group-hover/play:scale-110">
                  ►
                </span>
              </span>
            </button>
          )}

          {!docked ? (
            <button
              type="button"
              onClick={stop}
              aria-label="영상 닫기"
              className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-ink/60 text-sm text-paper opacity-0 transition-opacity hover:bg-ink/80 group-hover:opacity-100"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* PiP-only: title/subtitle always; body slides open on hover. */}
        {!docked ? (
          <div className="px-3 py-2 font-serif">
            <p className="truncate text-base font-medium text-ink">{title}</p>
            {watching.subtitle ? (
              <p className="truncate text-sm text-ink-faint">
                {watching.subtitle}
              </p>
            ) : null}
            {watching.body ? (
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]">
                <div className="overflow-hidden">
                  <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-soft opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                    {watching.body}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
