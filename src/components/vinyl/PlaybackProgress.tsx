import { useCallback, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

interface PlaybackProgressProps {
  currentTime: number;
  duration: number;
  disabled: boolean;
  onSeek: (seconds: number) => void;
  /** Width utility for the outer row (overridden by the mini player). */
  widthClass?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Playback progress bar shown under the vinyl. Click or drag anywhere on the
 * track to seek; arrow keys nudge by ±5s. Kept purely presentational — all
 * playback state comes from the YouTube player hook.
 */
export function PlaybackProgress({
  currentTime,
  duration,
  disabled,
  onSeek,
  widthClass = "w-72 max-w-full sm:w-80 lg:w-88",
}: PlaybackProgressProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const ratio = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const percent = `${ratio * 100}%`;

  const seekToClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return;
      const rect = track.getBoundingClientRect();
      const pos = (clientX - rect.left) / rect.width;
      const clamped = Math.min(Math.max(pos, 0), 1);
      onSeek(clamped * duration);
    },
    [duration, onSeek],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      seekToClientX(event.clientX);
    },
    [disabled, seekToClientX],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      seekToClientX(event.clientX);
    },
    [disabled, seekToClientX],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (disabled || duration <= 0) return;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        onSeek(Math.min(currentTime + 5, duration));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        onSeek(Math.max(currentTime - 5, 0));
      }
    },
    [currentTime, disabled, duration, onSeek],
  );

  return (
    <div className={`flex items-center gap-3 font-serif ${widthClass}`}>
      <span className="w-11 shrink-0 text-right text-sm tabular-nums text-ink-soft">
        {formatTime(currentTime)}
      </span>
      <div
        ref={trackRef}
        role="slider"
        aria-label="재생 위치"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        className={`group relative h-5 flex-1 cursor-pointer touch-none select-none ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cream-deep shadow-inner" />
        {/* Fill */}
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent"
          style={{ width: percent }}
        />
        {/* Handle */}
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-paper shadow-md transition-transform group-hover:scale-110"
          style={{ left: percent }}
        />
      </div>
      <span className="w-11 shrink-0 text-left text-sm tabular-nums text-ink-soft">
        {formatTime(duration)}
      </span>
    </div>
  );
}
