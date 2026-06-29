import { useState } from "react";
import type { TasteContent } from "../../types/content";

interface ContentCommentProps {
  content: TasteContent | null;
}

/**
 * Editorial display for the selected content. Title / subtitle / body share the
 * same serif family; the YouTube source is tucked behind a "더보기" toggle.
 */
export function ContentComment({ content }: ContentCommentProps) {
  const [showSource, setShowSource] = useState(false);

  if (content === null) return null;

  const title = content.title || content.sourceTitle;
  const url = `https://www.youtube.com/watch?v=${content.youtubeVideoId}`;

  return (
    <figure className="flex flex-col rounded-3xl border border-line bg-paper/70 p-6 font-serif shadow-sm sm:p-8">
      <figcaption className="flex flex-col gap-2">
        <span className="text-2xl font-medium text-ink sm:text-3xl">
          {title}
        </span>
        {content.subtitle ? (
          <span className="text-lg text-ink-faint sm:text-xl">
            {content.subtitle}
          </span>
        ) : null}
      </figcaption>

      {content.body ? (
        <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-soft">
          {content.body}
        </p>
      ) : null}

      <div className="mt-6 self-end text-right">
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          aria-expanded={showSource}
          className="text-xs text-ink-faint transition-colors hover:text-ink"
        >
          출처 {showSource ? "▴" : "▾"}
        </button>
        {showSource ? (
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-ink-faint">
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
    </figure>
  );
}
