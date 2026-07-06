// Minimal ambient typings for the YouTube IFrame Player API (only what this app
// uses). Declared globally — no import/export so the types stay ambient.

type YTPlayerStateValue = -1 | 0 | 1 | 2 | 3 | 5;

interface YTPlayerEvent {
  target: YTPlayerInstance;
  data: YTPlayerStateValue;
}

interface YTPlayerInstance {
  cueVideoById(videoId: string): void;
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  stopVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YTPlayerConstructorOptions {
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTPlayerEvent) => void;
  };
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: YTPlayerConstructorOptions,
  ) => YTPlayerInstance;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

interface Window {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
}
