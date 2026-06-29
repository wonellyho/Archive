import type { TasteContent } from "../../types/content";
import type { VinylSpinState } from "../../hooks/useYouTubePlayer";
import { VinylRecord } from "./VinylRecord";
import { PlaybackControls } from "./PlaybackControls";

interface VinylPlayerProps {
  content: TasteContent | null;
  spin: VinylSpinState;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export function VinylPlayer({
  content,
  spin,
  onPlay,
  onPause,
  onRestart,
}: VinylPlayerProps) {
  return (
    <div className="flex flex-col items-center gap-8 rounded-4xl border border-line bg-cream p-6 shadow-md sm:p-8">
      <VinylRecord
        spin={spin}
        thumbnailUrl={content?.thumbnailUrl}
        title={content?.title}
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
