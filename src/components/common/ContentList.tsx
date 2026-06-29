import type { TasteContent } from "../../types/content";
import { EmptyState } from "./EmptyState";

interface ContentListProps {
  contents: TasteContent[];
  selectedContentId: string | null;
  playingContentId: string | null;
  onSelect: (content: TasteContent) => void;
  onEdit: (content: TasteContent) => void;
  onDelete: (content: TasteContent) => void;
  label: string;
  emptyTitle: string;
  /** Drives the staggered entrance animation when the folder opens. */
  open: boolean;
  /** When false, edit/delete controls are hidden (visitors). */
  canEdit: boolean;
}

const iconButton =
  "rounded-full bg-paper/90 p-2 text-sm shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Responsive card grid: thumbnail, then user title / subtitle (shared font). */
export function ContentList({
  contents,
  selectedContentId,
  playingContentId,
  onSelect,
  onEdit,
  onDelete,
  label,
  emptyTitle,
  open,
  canEdit,
}: ContentListProps) {
  if (contents.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        hint={canEdit ? "검색해서 콘텐츠를 추가해 보세요." : undefined}
      />
    );
  }

  return (
    <ul
      aria-label={label}
      data-open={open}
      className="cascade grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {contents.map((content, index) => {
        const selected = content.id === selectedContentId;
        const playing = content.id === playingContentId;
        return (
          <li
            key={content.id}
            className="relative"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(content)}
              className={`group flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-paper text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? "border-accent shadow-md"
                  : "border-line hover:border-ink/30"
              }`}
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-cream-deep">
                <img
                  src={content.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {playing ? (
                  <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-medium text-paper">
                    Now playing
                  </span>
                ) : null}
              </span>
              <span className="flex flex-1 flex-col gap-1 p-4 font-serif">
                <span className="line-clamp-2 text-lg font-medium text-ink">
                  {content.title || content.sourceTitle}
                </span>
                {content.subtitle ? (
                  <span className="line-clamp-1 text-base text-ink-faint">
                    {content.subtitle}
                  </span>
                ) : null}
              </span>
            </button>

            {canEdit ? (
              <div className="absolute right-2 top-2 z-10 flex gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(content)}
                  aria-label={`${content.title || content.sourceTitle} 편집`}
                  className={`${iconButton} text-ink-soft hover:bg-paper hover:text-ink`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(content)}
                  aria-label={`${content.title || content.sourceTitle} 삭제`}
                  className={`${iconButton} text-ink-faint hover:bg-accent-soft hover:text-accent`}
                >
                  🗑
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
