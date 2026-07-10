import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { TasteContent } from "../types/content";
import { VideoContext } from "./videoContext";
import type { ActiveMedia, VideoContextValue } from "./videoContext";
import { usePlayer } from "./playerContext";

/**
 * Owns the one video player and coordinates it with the music player so only
 * the most-recently-started medium actually plays (the other auto-stops).
 * The iframe itself is rendered by PlaybackDock, which keeps it mounted.
 */
export function VideoProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  const { pause: pauseMusic, spin } = player;

  const [watching, setWatching] = useState<TasteContent | null>(null);
  const [anchor, setAnchorEl] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState<ActiveMedia>(null);

  const watch = useCallback((content: TasteContent) => {
    setWatching(content);
    setActive("video");
  }, []);
  const stop = useCallback(() => {
    setWatching(null);
    setActive((prev) => (prev === "video" ? null : prev));
  }, []);
  const setAnchor = useCallback((el: HTMLElement | null) => setAnchorEl(el), []);

  // Music started playing → it becomes the foreground medium.
  useEffect(() => {
    if (spin === "playing") setActive("music");
  }, [spin]);

  // Video became active → pause the music so they don't play together.
  useEffect(() => {
    if (active === "video") pauseMusic();
  }, [active, pauseMusic]);

  const value = useMemo<VideoContextValue>(
    () => ({ watching, anchor, active, watch, stop, setAnchor }),
    [watching, anchor, active, watch, stop, setAnchor],
  );

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}
