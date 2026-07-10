import { useState } from "react";
import type { TasteContent } from "../../types/content";

interface SourceToggleProps {
  content: TasteContent | null;
}

/**
 * "출처" toggle shown under the record. No box of its own — it sits inline so
 * opening it reads as part of the player, and the attribution slides open
 * smoothly instead of popping in.
 */
export function SourceToggle({ content }: SourceToggleProps) {
  const [showSource, setShowSource] = useState(false);

  if (content === null) return null;

  const url = `https://www.youtube.com/watch?v=${content.youtubeVideoId}`;

  return (
    <div className="font-serif">
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

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          showSource ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-1 flex flex-col gap-0.5 text-right text-xs text-ink-faint">
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
        </div>
      </div>
    </div>
  );
}
