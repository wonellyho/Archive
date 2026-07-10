import { createContext, useContext } from "react";
import type { TasteContent } from "../types/content";

/** Which medium is currently in the foreground (most recently started). */
export type ActiveMedia = "music" | "video" | null;

export interface VideoContextValue {
  /** The video loaded in the player (playing or paused as a stopped card). */
  watching: TasteContent | null;
  /** Inline TV screen to dock into; null → the player floats bottom-right. */
  anchor: HTMLElement | null;
  /** Which medium is active right now — only the active one actually plays. */
  active: ActiveMedia;
  /** Start (or resume) a video. Stops music and makes video the active medium. */
  watch: (content: TasteContent) => void;
  /** Stop and unmount the video player. */
  stop: () => void;
  /**
   * Register the inline TV screen to dock into. When null, the player floats as
   * a bottom-right PiP so playback continues in the background.
   */
  setAnchor: (el: HTMLElement | null) => void;
}

export const VideoContext = createContext<VideoContextValue | null>(null);

export function useVideo(): VideoContextValue {
  const value = useContext(VideoContext);
  if (value === null) {
    throw new Error("useVideo must be used within a VideoProvider");
  }
  return value;
}
