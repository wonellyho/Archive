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
  return (
    <div className="flex flex-col items-center gap-8 rounded-4xl border border-line bg-cream p-6 shadow-md sm:p-8">
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
  );
}
