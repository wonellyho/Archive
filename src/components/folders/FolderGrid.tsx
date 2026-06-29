import type { TasteFolder } from "../../types/folder";

interface FolderGridProps {
  folders: TasteFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  onEdit: (folder: TasteFolder) => void;
  onDelete: (folder: TasteFolder) => void;
  onAddFolder: () => void;
  countOf: (folderId: string) => number;
  /** When false, edit/delete controls and the add tile are hidden (visitors). */
  canEdit: boolean;
}

/** Instagram-style square folder tiles, 4 per row on large screens. */
export function FolderGrid({
  folders,
  selectedFolderId,
  onSelect,
  onEdit,
  onDelete,
  onAddFolder,
  countOf,
  canEdit,
}: FolderGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {folders.map((folder) => {
        const active = folder.id === selectedFolderId;
        return (
          <li key={folder.id} className="relative">
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(folder.id)}
              className={`group relative block aspect-square w-full overflow-hidden rounded-3xl border text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active ? "border-accent shadow-md" : "border-line"
              }`}
            >
              {folder.coverImageUrl ? (
                <img
                  src={folder.coverImageUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center bg-cream-deep text-4xl">
                  📁
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/80 to-transparent p-3 pt-8">
                <span className="block truncate font-serif text-base font-medium text-paper">
                  {folder.name}
                </span>
                <span className="text-xs text-paper/80">
                  {countOf(folder.id)}개
                </span>
              </span>
            </button>

            {canEdit ? (
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(folder)}
                  aria-label={`${folder.name} 폴더 편집`}
                  className="rounded-full bg-paper/90 p-2 text-sm text-ink-soft shadow-sm transition-colors hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(folder)}
                  aria-label={`${folder.name} 폴더 삭제`}
                  className="rounded-full bg-paper/90 p-2 text-sm text-ink-faint shadow-sm transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  🗑
                </button>
              </div>
            ) : null}
          </li>
        );
      })}

      {canEdit ? (
        <li>
          <button
            type="button"
            onClick={onAddFolder}
            className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line text-ink-faint transition-all duration-200 hover:-translate-y-1 hover:border-ink/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-3xl">＋</span>
            <span className="text-base">새 폴더</span>
          </button>
        </li>
      ) : null}
    </ul>
  );
}
