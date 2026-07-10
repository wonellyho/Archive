import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { TasteContent } from "../types/content";
import { VideoContext } from "./videoContext";
import type { VideoContextValue } from "./videoContext";
import { FloatingVideo } from "../components/television/FloatingVideo";

/**
 * Owns the one video player. The iframe lives here (not in a tab), so it keeps
 * playing when tabs/folders change; it docks into the inline TV screen when one
 * is on screen, and floats as a bottom-right PiP otherwise.
 */
export function VideoProvider({ children }: { children: ReactNode }) {
  const [watching, setWatching] = useState<TasteContent | null>(null);
  const [anchor, setAnchorEl] = useState<HTMLElement | null>(null);

  const watch = useCallback((content: TasteContent) => setWatching(content), []);
  const stop = useCallback(() => setWatching(null), []);
  const setAnchor = useCallback((el: HTMLElement | null) => setAnchorEl(el), []);

  const value = useMemo<VideoContextValue>(
    () => ({ watching, watch, stop, setAnchor }),
    [watching, watch, stop, setAnchor],
  );

  return (
    <VideoContext.Provider value={value}>
      {children}
      {watching ? (
        <FloatingVideo content={watching} anchor={anchor} onClose={stop} />
      ) : null}
    </VideoContext.Provider>
  );
}
