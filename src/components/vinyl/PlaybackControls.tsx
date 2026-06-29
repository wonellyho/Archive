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
  idle: "재생할 트랙을 선택하세요",
  ready: "재생 준비됨",
  playing: "재생 중",
  paused: "일시 정지",
  ended: "재생 완료",
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
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-lg font-medium text-ink">
          {content ? content.title || content.sourceTitle : "—"}
        </p>
        <p className="text-base text-ink-faint">
          {content ? content.sourceChannel : "트랙을 선택해 주세요"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {isPlaying ? (
          <Button onClick={onPause} disabled={disabled} aria-label="일시 정지">
            ❚❚ 일시정지
          </Button>
        ) : (
          <Button onClick={onPlay} disabled={disabled} aria-label="재생">
            ► 재생
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onRestart}
          disabled={disabled}
          aria-label="처음부터 다시 재생"
        >
          ↺ 처음부터
        </Button>
      </div>

      <p className="text-sm text-ink-faint" role="status">
        {statusLabel[spin]}
      </p>
    </div>
  );
}
