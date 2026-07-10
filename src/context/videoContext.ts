import { createContext, useContext } from "react";
import type { TasteContent } from "../types/content";

export interface VideoContextValue {
  /** The video currently playing (inline or as a floating PiP). */
  watching: TasteContent | null;
  /** Start watching a video (keeps playing across tabs/folders). */
  watch: (content: TasteContent) => void;
  /** Stop and unmount the player. */
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
