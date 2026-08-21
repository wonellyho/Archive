import { useState } from "react";
import { useAuth } from "../../context/authContext";
import { useTasteData } from "../../context/tasteDataContext";
import { LoginModal } from "./LoginModal";
import { ProfileSettingsModal } from "../profile/ProfileSettingsModal";
import { ShareProfileModal } from "../profile/ShareProfileModal";
import { PencilIcon, ShareIcon } from "../common/icons";

type OpenModal = "none" | "share" | "settings";

/** 로그인한 주인 영역: nav 높이에 맞춘 컴팩트 칩(이미지·username·공유/수정/로그아웃). */
function OwnerArea() {
  const { profile, updateProfile } = useTasteData();
  const { signOut } = useAuth();
  const [open, setOpen] = useState<OpenModal>("none");
  const handle = profile.username ? `@${profile.username}` : profile.name;

  const iconBtn =
    "liquid-icon-btn grid size-7 place-items-center rounded-full text-[0.95rem] text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

  return (
    <div className="flex items-center gap-2">
      {profile.profileImageUrl ? (
        <img
          src={profile.profileImageUrl}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover shadow-sm"
        />
      ) : (
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-cream-deep text-sm font-medium text-ink-soft">
          {(profile.username || profile.name || "·").charAt(0).toUpperCase()}
        </div>
      )}
      <span className="hidden max-w-32 truncate text-sm font-medium text-ink sm:inline">
        {handle}
      </span>

      <div className="liquid-chip flex items-center gap-0.5 rounded-full p-0.5">
        <button
          type="button"
          className={iconBtn}
          aria-label="Share"
          title="Share"
          onClick={() => setOpen("share")}
        >
          <ShareIcon />
        </button>
        <button
          type="button"
          className={iconBtn}
          aria-label="Edit profile"
          title="Edit profile"
          onClick={() => setOpen("settings")}
        >
          <PencilIcon />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="hidden text-xs text-ink-faint transition-colors hover:text-ink sm:inline"
      >
        Log out
      </button>

      {open === "share" ? (
        <ShareProfileModal
          username={profile.username}
          onClose={() => setOpen("none")}
        />
      ) : null}
      {open === "settings" ? (
        <ProfileSettingsModal
          profile={profile}
          onSave={updateProfile}
          onClose={() => setOpen("none")}
        />
      ) : null}
    </div>
  );
}

/** Owner entry point: login button (public) / compact profile chip (owner). */
export function OwnerControls() {
  const { mode, isOwner } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  // In local mode there is no login — the local user always owns the page.
  if (mode === "local") return null;

  return (
    <div className="flex items-center justify-end text-sm">
      {isOwner ? (
        <OwnerArea />
      ) : (
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="liquid-action rounded-full px-3 py-1.5 text-ink"
        >
          🔒 Admin
        </button>
      )}
      {loginOpen ? <LoginModal onClose={() => setLoginOpen(false)} /> : null}
    </div>
  );
}
