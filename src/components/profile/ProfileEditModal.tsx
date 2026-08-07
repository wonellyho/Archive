import { useState } from "react";
import type { Profile } from "../../types/profile";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { KeywordSelector } from "./KeywordSelector";

interface ProfileEditModalProps {
  profile: Profile;
  onSave: (profile: Profile) => Promise<void>;
  onClose: () => void;
}

const field =
  "rounded-2xl border border-line bg-paper px-4 py-2.5 font-serif text-base outline-none focus-visible:border-accent";

/** 인사말 탭 편집 — 인사말(bio)과 취향 키워드만. 이름·주소·이미지는 '프로필 수정'에서. */
export function ProfileEditModal({
  profile,
  onSave,
  onClose,
}: ProfileEditModalProps) {
  const [bio, setBio] = useState(profile.bio);
  const [keywords, setKeywords] = useState<string[]>(profile.keywords);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...profile, bio: bio.trim(), keywords });
      onClose();
    } catch {
      setError("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return (
    <Modal open title="인사말 편집" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">인사말</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            autoFocus
            placeholder="방문자에게 건네는 인사말을 적어보세요."
            className={`${field} resize-none leading-relaxed`}
          />
        </label>

        <div className="flex flex-col gap-2 text-base">
          <span className="text-ink-soft">취향 키워드</span>
          <span className="text-sm text-ink-faint">
            어울리는 키워드를 눌러 선택하세요. 다시 누르면 해제됩니다.
          </span>
          <KeywordSelector value={keywords} onChange={setKeywords} />
        </div>

        {error ? <p className="text-base text-accent">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
