import { useState } from "react";
import type { Profile } from "../../types/profile";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

interface ProfileEditModalProps {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onCancel: () => void;
}

const field =
  "rounded-2xl border border-line bg-paper px-4 py-2.5 font-serif text-base outline-none focus-visible:border-accent";

export function ProfileEditModal({
  profile,
  onSave,
  onCancel,
}: ProfileEditModalProps) {
  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline);
  const [bio, setBio] = useState(profile.bio);
  const [keywords, setKeywords] = useState(profile.keywords.join(", "));

  function handleSave() {
    onSave({
      ...profile,
      name: name.trim(),
      tagline: tagline.trim(),
      bio: bio.trim(),
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    });
  }

  return (
    <Modal open title="인사말 편집" onClose={onCancel}>
      <div className="flex flex-col gap-4">
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
          <span className="text-ink-soft">인사말</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="방문자에게 건네는 인사말을 적어보세요."
            className={`${field} resize-none leading-relaxed`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">키워드 (쉼표로 구분)</span>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Alternative, Film, Night Walk"
            className={field}
          />
        </label>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </div>
    </Modal>
  );
}
