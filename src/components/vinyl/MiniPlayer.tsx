import { useTasteData } from "../../context/tasteDataContext";
import { usePlayer } from "../../context/playerContext";
import { PlaybackProgress } from "./PlaybackProgress";

/**
 * Bottom-right status card for background music. Collapsed it shows only the
 * thumbnail + owner's title / subtitle; on hover (or focus) it grows upward to
 * reveal the body text, progress bar, and play/pause button. It appears only
 * when the track is playing somewhere other than the full on-screen player.
 */
export function MiniPlayer() {
  const player = usePlayer();
  const { musicContents } = useTasteData();

  const isPlaying = player.spin === "playing";
  const isActive = isPlaying || player.spin === "paused";
  const content =
    musicContents.find((c) => c.youtubeVideoId === player.currentVideoId) ?? null;

  // Hide while the same track's full player is on screen (would be redundant).
  const shownInline = content !== null && content.id === player.expandedId;
  if (!isActive || content === null || shownInline) return null;

  const title = content.title || content.sourceTitle;

  return (
    <div className="mini-player group fixed bottom-5 right-5 z-40 w-[min(22rem,calc(100vw-2.5rem))]">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper/95 shadow-xl backdrop-blur transition-colors group-hover:bg-cream/95">
        {/* Compact row — always visible */}
        <div className="flex items-center gap-3 p-2.5">
          <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
            <img
              src={content.thumbnailUrl}
              alt=""
              className="size-full object-cover"
            />
          </span>
          <span className="flex min-w-0 flex-col font-serif">
            <span className="truncate text-base font-medium text-ink">
              {title}
            </span>
            {content.subtitle ? (
              <span className="truncate text-sm text-ink-faint">
                {content.subtitle}
              </span>
            ) : null}
          </span>
        </div>

        {/* Expandable panel — revealed on hover / focus */}
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 px-3 pb-3 font-serif opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
              {content.body ? (
                <p className="max-h-28 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {content.body}
                </p>
              ) : null}

              <PlaybackProgress
                currentTime={player.currentTime}
                duration={player.duration}
                disabled={false}
                onSeek={player.seek}
                widthClass="w-full"
              />

              <button
                type="button"
                onClick={isPlaying ? player.pause : player.play}
                aria-label={isPlaying ? "일시정지" : "재생"}
                className="mx-auto flex size-11 items-center justify-center rounded-full bg-ink text-lg text-paper transition-transform hover:scale-105 active:scale-95"
              >
                {isPlaying ? "❚❚" : "►"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
