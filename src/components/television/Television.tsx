import { useLayoutEffect, useRef } from "react";
import type { TasteContent } from "../../types/content";
import { useVideo } from "../../context/videoContext";

interface TelevisionProps {
  content: TasteContent | null;
}

/**
 * The TV object: a framed 16:9 screen. The actual player is the shared
 * FloatingVideo, which docks onto this screen while it's on-screen — so leaving
 * the tab lets the video float on as a PiP instead of stopping.
 */
export function Television({ content }: TelevisionProps) {
  const { setAnchor } = useVideo();
  const screenRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setAnchor(content ? screenRef.current : null);
    return () => setAnchor(null);
  }, [content, setAnchor]);

  return (
    <div className="rounded-4xl border border-line bg-cream p-3 shadow-md sm:p-5">
      <div
        ref={screenRef}
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
      >
        {content ? null : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,#26242b,#0a090d)] text-center">
            <span className="text-4xl" aria-hidden="true">
              📺
            </span>
            <p className="text-base text-paper/80">Select something to watch</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between px-2">
        <span className="text-sm uppercase tracking-[0.25em] text-ink-faint">
          Television
        </span>
        <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
      </div>
    </div>
  );
}
