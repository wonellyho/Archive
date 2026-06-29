import type { YouTubeSearchResult } from "../../types/youtube";

interface YouTubeResultCardProps {
  result: YouTubeSearchResult;
  alreadySaved: boolean;
  onSelect: () => void;
}

export function YouTubeResultCard({
  result,
  alreadySaved,
  onSelect,
}: YouTubeResultCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-paper text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-cream-deep">
        <img
          src={result.thumbnailUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {alreadySaved ? (
          <span className="absolute right-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs text-paper">
            이미 저장됨
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="line-clamp-2 text-base font-medium text-ink">
          {result.title}
        </span>
        <span className="text-sm text-ink-faint">{result.channelTitle}</span>
      </span>
    </button>
  );
}
