import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { cropToDataUrl, fileToCoverDataUrl } from "../../utils/image";
import type { CropRect } from "../../utils/image";
import { htmlToPlainText } from "../../utils/richText";
import { ImageCropper } from "./ImageCropper";
import { RichTextEditor } from "./RichTextEditor";
import type { PinDraft } from "../../types/pin";
import { DEFAULT_TEXT_STYLE } from "../../types/pin";
import type { Pin } from "../../types/pin";

/** Enough for a board card and the enlarged view without bloating localStorage. */
const IMAGE_MAX_SIZE = 900;
const MAX_IMAGES = 6;

type Step = "images" | "text" | "stickers";

const STEPS: { id: Step; label: string }[] = [
  { id: "images", label: "Images" },
  { id: "text", label: "Text" },
  { id: "stickers", label: "Stickers" },
];

/**
 * Each picked image keeps its full-size version around: re-cropping works from
 * the original every time, so a second pass can widen a crop rather than only
 * ever cutting further into an already-cut JPEG.
 */
interface Picked {
  original: string;
  cropped: string;
  aspectRatio?: number;
}

function imageAspectRatio(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => reject(new Error("Couldn't read image size."));
    img.src = src;
  });
}

interface AddPinModalProps {
  pin?: Pin;
  onAdd?: (draft: PinDraft) => void;
  onSave?: (draft: PinDraft) => void;
  onClose: () => void;
}

/**
 * Pins up a new memory, one concern per tab: what's in it, how it reads, and
 * what's stuck on it. Images are downscaled to data URLs and kept in local
 * board state — there is no pins endpoint on the backend yet, so nothing is
 * uploaded. When there is one, only the submit handler changes: `PinDraft`
 * already carries exactly what the API would take.
 */
export function AddPinModal({ pin, onAdd, onSave, onClose }: AddPinModalProps) {
  const [step, setStep] = useState<Step>("images");
  const [images, setImages] = useState<Picked[]>(
    () => pin?.images.map((src) => ({ original: src, cropped: src })) ?? [],
  );
  const [content, setContent] = useState(pin?.content ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Freshly picked images are offered for cropping one after another; cancelling
  // one skips it rather than abandoning the rest.
  const [cropQueue, setCropQueue] = useState<number[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const start = images.length;
      const room = MAX_IMAGES - start;
      const encoded = await Promise.all(
        files
          .slice(0, room)
          .map((file) => fileToCoverDataUrl(file, IMAGE_MAX_SIZE)),
      );
      const ratios = await Promise.all(encoded.map(imageAspectRatio));
      setImages((current) => [
        ...current,
        ...encoded.map((src, i) => ({
          original: src,
          cropped: src,
          aspectRatio: ratios[i],
        })),
      ]);
      // Straight into the cropper: deciding the frame is part of adding the
      // photo, not a separate errand you have to remember to run.
      setCropQueue(encoded.map((_, i) => start + i));
    } catch {
      setError("Couldn't read one of those images.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a removal.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function nextInQueue() {
    setCropQueue((queue) => queue.slice(1));
  }

  async function applyCrop(index: number, rect: CropRect) {
    const target = images[index];
    nextInQueue();
    if (!target) return;
    try {
      const cropped = await cropToDataUrl(target.original, rect, IMAGE_MAX_SIZE);
      const aspectRatio = (target.aspectRatio ?? 1) * (rect.width / rect.height);
      setImages((current) =>
        current.map((img, i) =>
          i === index ? { ...img, cropped, aspectRatio } : img,
        ),
      );
    } catch {
      setError("Couldn't crop that image.");
    }
  }

  function submit() {
    const written = htmlToPlainText(content) !== "";
    if (images.length === 0 && !written) {
      setError("Add a photo or write something.");
      return;
    }
    const draft = {
      images: images.map((img) => img.cropped),
      aspectRatio: images[0]?.aspectRatio,
      content: written ? content : "",
      textStyle: pin?.textStyle ?? DEFAULT_TEXT_STYLE,
    };
    if (pin) onSave?.(draft);
    else onAdd?.(draft);
    onClose();
  }

  const cropping = cropQueue[0];
  if (cropping !== undefined && images[cropping]) {
    const index = cropping;
    const remaining = cropQueue.length;
    return (
      <Modal
        open
        title={remaining > 1 ? `Crop image (${remaining} left)` : "Crop image"}
        onClose={nextInQueue}
        widthClassName="max-w-xl"
      >
        <ImageCropper
          src={images[index].original}
          onApply={(rect) => applyCrop(index, rect)}
          onCancel={nextInQueue}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={pin ? "Edit memory" : "Add to the board"}
      onClose={onClose}
      widthClassName="max-w-xl"
    >
      <div className="flex flex-col gap-5">
        <div role="tablist" aria-label="Memory parts" className="pin-tabs">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={step === s.id}
              onClick={() => setStep(s.id)}
              className="pin-tab"
              data-active={step === s.id || undefined}
            >
              {s.label}
              {s.id === "images" && images.length > 0 ? (
                <span className="pin-tab-count">{images.length}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* One fixed-height well for all three tabs. Letting each size itself
            makes the dialog jump around the screen as you switch between them,
            which is worse than a little unused space on the shorter tabs. */}
        <div className="pin-panel">
          {step === "images" ? (
            <div className="flex flex-col gap-3">
              {images.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="group relative">
                      <img
                        src={img.cropped}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setCropQueue([i])}
                        className="absolute inset-x-0 bottom-0 rounded-b-lg bg-ink/60 py-0.5 text-xs text-paper opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        Crop
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove image ${i + 1}`}
                        onClick={() =>
                          setImages((current) =>
                            current.filter((_, j) => j !== i),
                          )
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
              <p className="text-xs text-ink-faint">
                {images.length > 0
                  ? "Hover a thumbnail to crop it again."
                  : `Up to ${MAX_IMAGES} images. You'll be asked to crop each one, and they page through like a carousel when the memory is opened.`}
              </p>
            </div>
          ) : null}

          {step === "text" ? (
            <RichTextEditor initialHtml={content} onChange={setContent} />
          ) : null}

          {step === "stickers" ? (
            <div className="grid h-full place-content-center rounded-2xl border border-dashed border-line px-6 text-center">
              <p className="text-base text-ink-soft">Stickers aren't here yet.</p>
              <p className="mt-1 text-sm text-ink-faint">
                For now, tape and tacks can be added from the pin itself once
                it's on the board.
              </p>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-accent">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Reading…" : pin ? "Save changes" : "Add to board"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
