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
  "rounded-2xl border border-line bg-paper px-4 py-2.5 text-base outline-none focus-visible:border-accent";

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

  const typeLabel = type === "music" ? "음악" : "영상";

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
      !window.confirm("이미 저장된 콘텐츠입니다. 그래도 추가할까요?")
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
      aria-label={`${typeLabel} 추가`}
      className="flex flex-col gap-5 rounded-4xl border border-line bg-cream p-6 shadow-md sm:p-8"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium text-ink">{typeLabel} 추가</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1.5 text-base text-ink-faint transition-colors hover:text-ink"
        >
          닫기 ✕
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

          {status === "loading" ? <EmptyState title="검색 중입니다…" /> : null}

          {status === "success" && results.length === 0 ? (
            <EmptyState
              title="검색 결과가 없습니다."
              hint="다른 검색어를 입력해 보세요."
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
                {showPreview ? "미리보기 닫기" : "미리보기"}
              </button>
            </div>

            <p className="flex-1 text-sm text-ink-faint">
              출처 · {selected.title}
              <br />
              {selected.channelTitle}
            </p>
          </div>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="내가 붙이는 제목"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">부제목</span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="회색으로 표시되는 부제목 (선택)"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">본문</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="이 콘텐츠가 나에게 어떤 의미인지 적어보세요."
              className={`${fieldClass} resize-none leading-relaxed`}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-ink-soft">폴더</span>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className={fieldClass}
            >
              <option value={NONE}>미분류</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
              <option value={NEW}>+ 새 폴더 만들기</option>
            </select>
          </label>

          {folderId === NEW ? (
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="새 폴더 이름"
              aria-label="새 폴더 이름"
              className={fieldClass}
            />
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              ← 결과로
            </Button>
            <Button onClick={handleSave}>저장</Button>
          </div>
        </div>
      )}
    </section>
  );
}
