import type { VinylSpinState } from "../../hooks/useYouTubePlayer";
import type { TasteContent } from "../../types/content";
import { Button } from "../common/Button";

interface PlaybackControlsProps {
  content: TasteContent | null;
  spin: VinylSpinState;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
}

const statusLabel: Record<VinylSpinState, string> = {
  idle: "Select a track to play",
  ready: "Ready to play",
  playing: "Playing",
  paused: "Paused",
  ended: "Finished",
};

export function PlaybackControls({
  content,
  spin,
  onPlay,
  onPause,
  onRestart,
}: PlaybackControlsProps) {
  const disabled = content === null;
  const isPlaying = spin === "playing";

  return (
    <div className="flex flex-col items-center gap-4 font-serif">
      <div className="flex items-center gap-3">
        {isPlaying ? (
          <Button
            onClick={onPause}
            disabled={disabled}
            aria-label="Pause"
            className="font-serif"
          >
            ❚❚ Pause
          </Button>
        ) : (
          <Button
            onClick={onPlay}
            disabled={disabled}
            aria-label="Play"
            className="font-serif"
          >
            ► Play
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onRestart}
          disabled={disabled}
          aria-label="Restart from the beginning"
          className="font-serif"
        >
          ↺ Restart
        </Button>
      </div>

      <p className="text-sm text-ink-faint" role="status">
        {statusLabel[spin]}
      </p>
    </div>
  );
}
