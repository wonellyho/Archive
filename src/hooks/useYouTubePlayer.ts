import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type VinylSpinState = "idle" | "ready" | "playing" | "paused" | "ended";

let apiPromise: Promise<void> | null = null;

/** Loads the IFrame Player API script exactly once for the whole app. */
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export interface YouTubePlayerApi {
  /** Attach to the element the player mounts into (it becomes an iframe). */
  containerRef: RefObject<HTMLDivElement | null>;
  spin: VinylSpinState;
  currentVideoId: string | null;
  /** Cue a track without auto-playing (sets spin to "ready"). */
  selectTrack: (videoId: string) => void;
  play: () => void;
  pause: () => void;
  restart: () => void;
  /** Stop playback and reset to idle (used when switching modes). */
  stop: () => void;
}

/**
 * Drives a single hidden YouTube player for music. Playback state from the
 * IFrame API is mapped to a vinyl spin state so the record and the audio never
 * drift apart. Only one track is ever loaded, so music never overlaps.
 */
export function useYouTubePlayer(): YouTubePlayerApi {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const pendingVideoIdRef = useRef<string | null>(null);
  const [spin, setSpin] = useState<VinylSpinState>("idle");
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wrapper = containerRef.current;

    loadYouTubeApi().then(() => {
      const YT = window.YT;
      if (cancelled || !YT || !wrapper || playerRef.current) {
        return;
      }
      // The API replaces the element it's given with an <iframe>. Hand it a
      // child node we create imperatively so React never reconciles it (React
      // only manages the stable `wrapper`), avoiding removeChild crashes.
      const host = document.createElement("div");
      wrapper.appendChild(host);
      playerRef.current = new YT.Player(host, {
        playerVars: { playsinline: 1, controls: 0, disablekb: 1 },
        events: {
          onReady: () => {
            if (pendingVideoIdRef.current) {
              playerRef.current?.cueVideoById(pendingVideoIdRef.current);
              pendingVideoIdRef.current = null;
            }
          },
          onStateChange: (event) => {
            const state = window.YT?.PlayerState;
            if (!state) return;
            if (event.data === state.PLAYING) setSpin("playing");
            else if (event.data === state.PAUSED) setSpin("paused");
            else if (event.data === state.ENDED) setSpin("ended");
            else if (event.data === state.CUED) setSpin("ready");
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      // Clear the YT-managed iframe; React's wrapper goes back to empty.
      if (wrapper) wrapper.innerHTML = "";
    };
  }, []);

  const selectTrack = useCallback((videoId: string) => {
    setCurrentVideoId(videoId);
    setSpin("ready");
    if (playerRef.current) {
      playerRef.current.cueVideoById(videoId);
    } else {
      pendingVideoIdRef.current = videoId;
    }
  }, []);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const restart = useCallback(() => {
    playerRef.current?.seekTo(0, true);
    playerRef.current?.playVideo();
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stopVideo();
    setSpin("idle");
    setCurrentVideoId(null);
  }, []);

  return {
    containerRef,
    spin,
    currentVideoId,
    selectTrack,
    play,
    pause,
    restart,
    stop,
  };
}
