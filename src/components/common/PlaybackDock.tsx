import { useTasteData } from "../../context/tasteDataContext";
import { usePlayer } from "../../context/playerContext";
import { useVideo } from "../../context/videoContext";
import { MiniPlayer } from "../vinyl/MiniPlayer";
import { FloatingVideo } from "../television/FloatingVideo";

/**
 * Bottom-right stack for background players. The music mini and the video PiP
 * share one column (same width) and the most-recently-started one sits on top.
 * A docked video escapes this column (fixed to the inline screen).
 */
export function PlaybackDock() {
  const player = usePlayer();
  const { watching, active } = useVideo();
  const { musicContents } = useTasteData();

  const musicContent =
    musicContents.find((c) => c.youtubeVideoId === player.currentVideoId) ?? null;
  const musicVisible =
    musicContent !== null &&
    (player.spin === "playing" || player.spin === "paused") &&
    musicContent.id !== player.expandedId;
  const videoVisible = watching !== null;

  if (!musicVisible && !videoVisible) return null;

  const musicNode = musicVisible ? <MiniPlayer key="music" /> : null;
  const videoNode = videoVisible ? <FloatingVideo key="video" /> : null;
  // The active medium stacks on top (rendered first in the bottom-anchored column).
  const nodes =
    active === "video" ? [videoNode, musicNode] : [musicNode, videoNode];

  return (
    <div className="fixed bottom-5 right-5 z-40 flex w-[min(26rem,calc(100vw-2.5rem))] flex-col gap-3">
      {nodes}
    </div>
  );
}
