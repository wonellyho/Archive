import type { TasteContent } from "../../types/content";
import type { VinylSpinState } from "../../hooks/useYouTubePlayer";
import { VinylRecord } from "./VinylRecord";
import { PlaybackControls } from "./PlaybackControls";
import { PlaybackProgress } from "./PlaybackProgress";

interface VinylPlayerProps {
  content: TasteContent | null;
  spin: VinylSpinState;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
}

export function VinylPlayer({
  content,
  spin,
  currentTime,
  duration,
  onPlay,
  onPause,
  onRestart,
  onSeek,
}: VinylPlayerProps) {
  const displayTitle = content ? content.title || content.sourceTitle : "";

  return (
    <div className="rounded-4xl border border-line bg-cream p-6 shadow-md sm:p-8">
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-stretch lg:gap-10">
        {/* Left — the record and its playback controls */}
        <div className="flex w-full shrink-0 flex-col items-center gap-6 lg:w-auto">
          <VinylRecord
            spin={spin}
            thumbnailUrl={content?.thumbnailUrl}
            title={content?.title}
          />
          <PlaybackProgress
            currentTime={currentTime}
            duration={duration}
            disabled={content === null}
            onSeek={onSeek}
          />
          <PlaybackControls
            content={content}
            spin={spin}
            onPlay={onPlay}
            onPause={onPause}
            onRestart={onRestart}
          />
        </div>

        {/* Right — the owner's own words about this track */}
        <div className="flex w-full flex-col justify-center gap-3 font-serif lg:border-l lg:border-line/70 lg:pl-10">
          {content ? (
            <>
              <p className="text-2xl font-medium leading-snug text-ink sm:text-3xl">
                {displayTitle}
              </p>
              {content.subtitle ? (
                <p className="text-lg text-ink-faint sm:text-xl">
                  {content.subtitle}
                </p>
              ) : null}
              {content.body ? (
                <p className="mt-3 max-w-prose whitespace-pre-line text-base leading-relaxed text-ink-soft">
                  {content.body}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-lg text-ink-faint">트랙을 선택해 주세요</p>
          )}
        </div>
      </div>
    </div>
  );
}
