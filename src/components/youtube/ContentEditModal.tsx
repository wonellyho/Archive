import { useState } from "react";
import type { TasteContent } from "../../types/content";
import type { ContentPatch } from "../../context/tasteDataContext";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

interface ContentEditModalProps {
  content: TasteContent;
  onSave: (patch: ContentPatch) => void;
  onCancel: () => void;
}

const field =
  "rounded-2xl border border-line bg-paper px-4 py-2.5 text-base outline-none focus-visible:border-accent";

export function ContentEditModal({
  content,
  onSave,
  onCancel,
}: ContentEditModalProps) {
  const [title, setTitle] = useState(content.title);
  const [subtitle, setSubtitle] = useState(content.subtitle);
  const [body, setBody] = useState(content.body);

  function handleSave() {
    onSave({
      title: title.trim() || content.sourceTitle,
      subtitle: subtitle.trim(),
      body: body.trim(),
    });
  }

  return (
    <Modal open title="콘텐츠 편집" onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">부제목</span>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="회색으로 표시되는 부제목 (선택)"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">본문</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="이 콘텐츠가 나에게 어떤 의미인지 적어보세요."
            className={`${field} resize-none leading-relaxed`}
          />
        </label>

        <p className="text-sm text-ink-faint">출처 · {content.sourceTitle}</p>

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
