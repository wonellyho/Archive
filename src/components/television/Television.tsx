import type { TasteContent } from "../../types/content";
import { TelevisionPlayer } from "./TelevisionPlayer";

interface TelevisionProps {
  content: TasteContent | null;
}

/** The TV object: a framed 16:9 screen that holds the player or an idle card. */
export function Television({ content }: TelevisionProps) {
  return (
    <div className="rounded-4xl border border-line bg-cream p-3 shadow-md sm:p-5">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        {content ? (
          <TelevisionPlayer content={content} />
        ) : (
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
