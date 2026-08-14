import { useState } from "react";
import type { ContentType } from "../../types/content";
import type { TasteFolder } from "../../types/folder";
import type { YouTubeSearchResult } from "../../types/youtube";
import type { NewContentInput } from "../../context/tasteDataContext";
import { useYouTubeSearch } from "../../hooks/useYouTubeSearch";
import { youtubeEmbedUrl } from "../../utils/youtube";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { YouTubeSearchForm } from "./YouTubeSearchForm";
import { YouTubeResultCard } from "./YouTubeResultCard";

const NONE = "__none";
const NEW = "__new";

interface AddContentPanelProps {
  type: ContentType;
  folders: TasteFolder[];
  defaultFolderId: string | null;
  onAddFolder: (name: string) => TasteFolder;
  onAddContent: (input: NewContentInput) => void;
  hasContent: (youtubeVideoId: string) => boolean;
  onClose: () => void;
}

const fieldClass =
  "rounded-2xl border border-line bg-paper px-4 py-2.5 font-serif text-base outline-none focus-visible:border-accent";

export function AddContentPanel({
  type,
  folders,
  defaultFolderId,
  onAddFolder,
  onAddContent,
  hasContent,
  onClose,
}: AddContentPanelProps) {
  const { status, results, error, search } = useYouTubeSearch();
  const [selected, setSelected] = useState<YouTubeSearchResult | null>(null);
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? NONE);
  const [newFolderName, setNewFolderName] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const typeLabel = type === "music" ? "Music" : "Video";

  function selectResult(result: YouTubeSearchResult) {
    setSelected(result);
    setTitle(result.title); // prefill, user can rewrite
    setSubtitle("");
    setBody("");
    setShowPreview(false);
  }

  function handleSave() {
    if (!selected) return;
    let finalFolderId: string | null;
    if (folderId === NEW) {
      const name = newFolderName.trim();
      if (name.length === 0) return;
      finalFolderId = onAddFolder(name).id;
    } else if (folderId === NONE) {
      finalFolderId = null;
    } else {
      finalFolderId = folderId;
    }

    if (
      hasContent(selected.youtubeVideoId) &&
      !window.confirm("This content is already saved. Add it anyway?")
    ) {
      return;
    }

    onAddContent({
      type,
      folderId: finalFolderId,
      youtubeVideoId: selected.youtubeVideoId,
      sourceTitle: selected.title,
      sourceChannel: selected.channelTitle,
      thumbnailUrl: selected.thumbnailUrl,
      title: title.trim() || selected.title,
      subtitle: subtitle.trim(),
      body: body.trim(),
    });
    onClose();
  }

  return (
    <section
      aria-label={`Add ${typeLabel.toLowerCase()}`}
      className="flex flex-col gap-5 rounded-4xl border border-line bg-cream p-6 font-serif shadow-md sm:p-8"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium text-ink">Add {typeLabel.toLowerCase()}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1.5 text-base text-ink-faint transition-colors hover:text-ink"
        >
          Close ✕
        </button>
      </div>

      {!selected ? (
        <>
          <YouTubeSearchForm
            onSearch={(q) => search(q, type)}
            loading={status === "loading"}
          />

          {status === "error" && error ? (
            <p role="alert" className="text-base text-accent">
              {error}
            </p>
          ) : null}

          {status === "loading" ? <EmptyState title="Searching…" /> : null}

          {status === "success" && results.length === 0 ? (
            <EmptyState
              title="No results found."
              hint="Try a different search term."
            />
          ) : null}

          {results.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((result) => (
                <li key={result.youtubeVideoId}>
                  <YouTubeResultCard
                    result={result}
                    alreadySaved={hasContent(result.youtubeVideoId)}
                    onSelect={() => selectResult(result)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full sm:w-64">
              {showPreview ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={youtubeEmbedUrl(selected.youtubeVideoId)}
                    title={selected.title}
                    allow="encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <img
                  src={selected.thumbnailUrl}
                  alt=""
                  className="aspect-video w-full rounded-2xl object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="mt-2 text-base text-accent hover:underline"
              >
                {showPreview ? "Close preview" : "Preview"}
              </button>
            </div>

            <p className="flex-1 text-sm text-ink-faint">
              Source · {selected.title}
              <br />
              {selected.channelTitle}
            </p>
          </div>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Your own title"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">Subtitle</span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Shown in grey (optional)"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Write what this content means to you."
              className={`${fieldClass} resize-none leading-relaxed`}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">Folder</span>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className={fieldClass}
            >
              <option value={NONE}>Unsorted</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
              <option value={NEW}>+ Create new folder</option>
            </select>
          </label>

          {folderId === NEW ? (
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              aria-label="New folder name"
              className={fieldClass}
            />
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              ← Back to results
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}
    </section>
  );
}
