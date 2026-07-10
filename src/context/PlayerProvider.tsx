import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { PlayerContext } from "./playerContext";
import type { PlayerContextValue } from "./playerContext";

/**
 * Owns the one music player for the whole page. The hidden host stays mounted
 * here — not inside a tab — so switching tabs never tears the player down and
 * the music keeps playing in the background.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useYouTubePlayer();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const value = useMemo<PlayerContextValue>(
    () => ({ ...player, expandedId, setExpandedId }),
    [player, expandedId],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* Hidden audio host — always mounted (survives tab changes). */}
      <div
        ref={player.containerRef}
        className="pointer-events-none fixed size-px overflow-hidden opacity-0"
        aria-hidden="true"
      />
    </PlayerContext.Provider>
  );
}
