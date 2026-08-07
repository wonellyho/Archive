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
    if (err.status === 409) return "이미 사용 중인 username입니다.";
    if (err.status === 422)
      return "username 형식을 확인해 주세요 (영문 소문자·숫자·_·-, 3~30자).";
    if (err.status === 401) return "로그인이 필요합니다. 다시 로그인해 주세요.";
    return `저장에 실패했습니다 (HTTP ${err.status}).`;
  }
  return "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
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
        ? "이미지 용량이 너무 큽니다."
        : "이미지를 불러오지 못했습니다.");
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
    <Modal open title="프로필 수정" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* 프로필 이미지 */}
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
              {uploading ? "업로드 중…" : "이미지 변경"}
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
                이미지 제거
              </button>
            ) : null}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">한 줄 소개</span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">
            공개 주소 (username)
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
            영문 소문자·숫자·_·-, 3~30자. 공유 링크·취향 타임라인 주소가 됩니다.
          </span>
        </label>

        {error ? <p className="text-base text-accent">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
