import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { fileToCoverBlob, fileToCoverDataUrl } from "../../utils/image";
import { ApiError, isApiConfigured, uploadImage } from "../../services/apiClient";

/** 업로드 실패 상태코드를 사용자용 메시지로 변환한다. */
function uploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Please log in to continue.";
    if (err.status === 400)
      return "Unsupported image format (JPEG/PNG/WEBP/GIF).";
    if (err.status === 413) return "The image file is too large.";
    if (err.status === 429)
      return "Too many uploads. Please try again shortly.";
    return `Image upload failed (HTTP ${err.status}).`;
  }
  return "Failed to load the image.";
}

interface FolderFormModalProps {
  title: string;
  initialName?: string;
  initialCover?: string;
  onSubmit: (data: { name: string; coverImageUrl?: string }) => void;
  onCancel: () => void;
}

export function FolderFormModal({
  title,
  initialName = "",
  initialCover,
  onSubmit,
  onCancel,
}: FolderFormModalProps) {
  const [name, setName] = useState(initialName);
  const [cover, setCover] = useState<string | undefined>(initialCover);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // 백엔드가 설정되면 Storage 업로드(URL 저장), 아니면 base64 인라인 폴백.
      if (isApiConfigured) {
        const blob = await fileToCoverBlob(file);
        setCover(await uploadImage(blob));
      } else {
        setCover(await fileToCoverDataUrl(file));
      }
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Please enter a folder name.");
      return;
    }
    onSubmit({ name: trimmed, coverImageUrl: cover });
  }

  return (
    <Modal open title={title} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">Folder name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Night Walk"
            className="rounded-2xl border border-line bg-paper px-4 py-2.5 font-serif text-base outline-none focus-visible:border-accent"
          />
        </label>

        <div className="flex flex-col gap-2 text-base">
          <span className="text-ink-soft">Folder thumbnail image</span>
          <div className="flex items-center gap-4">
            <div className="size-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-cream-deep">
              {cover ? (
                <img src={cover} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-2xl text-ink-faint">
                  🖼
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label
                className={`rounded-full border border-line px-4 py-2 text-base text-ink-soft transition-colors ${
                  uploading
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:bg-cream hover:text-ink"
                }`}
              >
                {uploading ? "Uploading…" : "Attach image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              {cover ? (
                <button
                  type="button"
                  onClick={() => setCover(undefined)}
                  className="text-left text-sm text-ink-faint hover:text-accent"
                >
                  Remove image
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? <p className="text-base text-accent">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={uploading}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
