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
    <Modal open title="Share Profile" onClose={onClose}>
      {username ? (
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink-soft">
            Share this link to let others view your archive.
          </p>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-2xl border border-line bg-cream px-4 py-2.5 text-base text-ink-soft outline-none"
            />
            <Button onClick={copy} className="shrink-0">
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink-soft">
            To create a share link, first set a <b>public address (username)</b>.
            <br />
            You can set one from <b>Edit Profile</b> in the top right.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
