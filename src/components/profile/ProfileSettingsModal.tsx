import { useState } from "react";
import type { Profile } from "../../types/profile";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { fileToCoverBlob, fileToCoverDataUrl } from "../../utils/image";
import { ApiError, isApiConfigured, uploadImage } from "../../services/apiClient";

interface ProfileSettingsModalProps {
  profile: Profile;
  onSave: (profile: Profile) => Promise<void>;
  onClose: () => void;
}

const field =
  "rounded-2xl border border-line bg-paper px-4 py-2.5 font-serif text-base outline-none focus-visible:border-accent";

function saveErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "This username is already taken.";
    if (err.status === 422)
      return "Please check the username format (lowercase letters, numbers, _, -, 3–30 characters).";
    if (err.status === 401) return "Please log in to continue.";
    return `Save failed (HTTP ${err.status}).`;
  }
  return "Save failed. Please try again shortly.";
}

/** 프로필(정체성) 편집 — 이미지·이름·한 줄 소개·공개 주소(username). */
export function ProfileSettingsModal({
  profile,
  onSave,
  onClose,
}: ProfileSettingsModalProps) {
  const [image, setImage] = useState<string | undefined>(profile.profileImageUrl);
  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline);
  const [username, setUsername] = useState(profile.username ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      if (isApiConfigured) {
        setImage(await uploadImage(await fileToCoverBlob(file)));
      } else {
        setImage(await fileToCoverDataUrl(file));
      }
    } catch (err) {
      setError(err instanceof ApiError && err.status === 413
        ? "The image file is too large."
        : "Failed to load the image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...profile,
        profileImageUrl: image,
        name: name.trim(),
        tagline: tagline.trim(),
        username: username.trim().toLowerCase() || undefined,
      });
      onClose();
    } catch (err) {
      setError(saveErrorMessage(err));
      setSaving(false);
    }
  }

  const busy = saving || uploading;

  return (
    <Modal open title="Edit Profile" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Profile image */}
        <div className="flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-full border border-line bg-cream-deep">
            {image ? (
              <img src={image} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl text-ink-faint">
                🙂
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
              {uploading ? "Uploading…" : "Change image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            {image ? (
              <button
                type="button"
                onClick={() => setImage(undefined)}
                className="text-left text-sm text-ink-faint hover:text-accent"
              >
                Remove image
              </button>
            ) : null}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">Tagline</span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">
            Public address (username)
            <span className="ml-2 text-sm text-ink-faint">/u/…</span>
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="maydove"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={field}
          />
          <span className="text-sm text-ink-faint">
            Lowercase letters, numbers, _, -, 3–30 characters. Used for your share link and taste timeline.
          </span>
        </label>

        {error ? <p className="text-base text-accent">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
