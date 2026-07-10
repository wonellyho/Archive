import { createContext, useContext } from "react";
import type { YouTubePlayerApi } from "../hooks/useYouTubePlayer";

export interface PlayerContextValue extends YouTubePlayerApi {
  /** Id of the content whose full (inline) player is on screen, if any. */
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}

/**
 * Shared music player. Lives above the tabs so playback survives tab changes
 * (background playback). See PlayerProvider for the single hidden host.
 */
export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext);
  if (value === null) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return value;
}
