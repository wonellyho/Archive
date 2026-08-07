import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

interface ShareProfileModalProps {
  username?: string;
  onClose: () => void;
}

/** 공개 프로필 공유 링크(/u/{username})를 보여주고 복사한다. */
export function ShareProfileModal({ username, onClose }: ShareProfileModalProps) {
  const [copied, setCopied] = useState(false);
  const link = username ? `${window.location.origin}/u/${username}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal open title="프로필 공유" onClose={onClose}>
      {username ? (
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink-soft">
            이 링크로 내 아카이브를 공유할 수 있어요.
          </p>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-2xl border border-line bg-cream px-4 py-2.5 text-base text-ink-soft outline-none"
            />
            <Button onClick={copy} className="shrink-0">
              {copied ? "복사됨 ✓" : "복사"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink-soft">
            공유 링크를 만들려면 먼저 <b>공개 주소(username)</b>를 설정하세요.
            <br />
            우측 상단 <b>프로필 수정</b>에서 정할 수 있어요.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
