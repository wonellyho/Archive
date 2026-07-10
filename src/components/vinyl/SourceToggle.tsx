import { useState } from "react";
import type { TasteContent } from "../../types/content";

interface SourceToggleProps {
  content: TasteContent | null;
}

/**
 * Slim "출처" box kept at the position where the editorial card used to sit.
 * The user-authored fields now live beside the record; only the YouTube
 * attribution remains here, tucked behind a toggle.
 */
export function SourceToggle({ content }: SourceToggleProps) {
  const [showSource, setShowSource] = useState(false);

  if (content === null) return null;

  const url = `https://www.youtube.com/watch?v=${content.youtubeVideoId}`;

  return (
    <div className="rounded-3xl border border-line bg-paper/70 px-6 py-4 font-serif shadow-sm">
      <div className="text-right">
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          aria-expanded={showSource}
          className="text-xs text-ink-faint transition-colors hover:text-ink"
        >
          출처 {showSource ? "▴" : "▾"}
        </button>
      </div>
      {showSource ? (
        <div className="mt-2 flex flex-col gap-0.5 text-xs text-ink-faint">
          <span>{content.sourceTitle}</span>
          {content.sourceChannel ? <span>{content.sourceChannel}</span> : null}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-accent hover:underline"
          >
            {url}
          </a>
        </div>
      ) : null}
    </div>
  );
}
