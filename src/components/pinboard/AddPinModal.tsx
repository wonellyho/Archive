import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { fileToCoverDataUrl } from "../../utils/image";
import type { PinDraft } from "../../types/pin";

/** Enough for a board card and the enlarged view without bloating localStorage. */
const IMAGE_MAX_SIZE = 900;
const MAX_IMAGES = 6;

interface AddPinModalProps {
  onAdd: (draft: PinDraft) => void;
  onClose: () => void;
}

/**
 * Pins up a new memory. Images are downscaled to data URLs and kept in local
 * board state — there is no pins endpoint on the backend yet, so nothing is
 * uploaded. When there is one, only the submit handler changes: `PinDraft`
 * already carries exactly what the API would take.
 */
export function AddPinModal({ onAdd, onClose }: AddPinModalProps) {
  const [images, setImages] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const room = MAX_IMAGES - images.length;
      const encoded = await Promise.all(
        files
          .slice(0, room)
          .map((file) => fileToCoverDataUrl(file, IMAGE_MAX_SIZE)),
      );
      setImages((current) => [...current, ...encoded]);
    } catch {
      setError("Couldn't read one of those images.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a removal.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function submit() {
    const text = content.trim();
    if (images.length === 0 && text === "") {
      setError("Add a photo or write something.");
      return;
    }
    onAdd({ images, content: text });
    onClose();
  }

  return (
    <Modal open title="Add to the board" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-faint">Images</span>
          {images.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover shadow-sm"
                  />
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() =>
                      setImages((current) => current.filter((_, j) => j !== i))
                    }
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-xs text-paper"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            onChange={pickFiles}
            disabled={busy || images.length >= MAX_IMAGES}
            className="text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-1.5 file:text-sm file:text-ink hover:file:bg-cream"
          />
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-ink-faint">Memory</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="What do you want to remember about this?"
            className="w-full resize-y rounded-2xl border border-line bg-paper/60 px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus:border-ink/40"
          />
        </label>

        {error ? <p className="text-sm text-accent">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Reading…" : "Add to board"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
