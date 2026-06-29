import { useState } from "react";
import { useAuth } from "../../context/authContext";
import { LoginModal } from "./LoginModal";

/** Small owner entry point: login button (public) / edit-mode badge (owner). */
export function OwnerControls() {
  const { mode, isOwner, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  // In local mode there is no login — the local user always owns the page.
  if (mode === "local") return null;

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      {isOwner ? (
        <>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-accent">
            편집 모드
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full px-3 py-1 text-ink-faint transition-colors hover:text-ink"
          >
            로그아웃
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="rounded-full px-3 py-1 text-ink-faint transition-colors hover:text-ink"
        >
          🔒 관리자
        </button>
      )}
      {loginOpen ? <LoginModal onClose={() => setLoginOpen(false)} /> : null}
    </div>
  );
}
