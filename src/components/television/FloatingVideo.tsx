import { useLayoutEffect, useRef } from "react";
import type { TasteContent } from "../../types/content";
import { youtubeEmbedUrl } from "../../utils/youtube";

interface FloatingVideoProps {
  content: TasteContent;
  /** Inline TV screen to dock into; null → float as a bottom-right PiP. */
  anchor: HTMLElement | null;
  onClose: () => void;
}

/**
 * A single persistent YouTube iframe. It docks over the inline TV screen when
 * an anchor is provided, and floats as a bottom-right picture-in-picture when
 * not — the iframe never remounts, so the video keeps playing across the move.
 */
export function FloatingVideo({ content, anchor, onClose }: FloatingVideoProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const docked = anchor !== null;

  // Docked: keep the fixed wrapper glued to the inline screen (follows scroll /
  // resize via rAF). PiP: clear inline styles and let the CSS classes place it.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    if (!docked) {
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

  const title = content.title || content.sourceTitle;

  return (
    <div
      ref={wrapperRef}
      className={
        docked
          ? "fixed z-30"
          : "group fixed bottom-5 right-5 z-30 w-[min(26rem,calc(100vw-2.5rem))]"
      }
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
          <iframe
            key={content.id}
            className="absolute inset-0 h-full w-full"
            src={youtubeEmbedUrl(content.youtubeVideoId, { autoplay: 1 })}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />

          {!docked ? (
            <button
              type="button"
              onClick={onClose}
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
            {content.subtitle ? (
              <p className="truncate text-sm text-ink-faint">
                {content.subtitle}
              </p>
            ) : null}
            {content.body ? (
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]">
                <div className="overflow-hidden">
                  <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-soft opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                    {content.body}
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
