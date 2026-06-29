import { useState } from "react";
import { useTasteData } from "../../context/tasteDataContext";
import { useAuth } from "../../context/authContext";
import { TasteKeywords } from "./TasteKeywords";
import { ProfileEditModal } from "./ProfileEditModal";
import { Button } from "../common/Button";

/** The "인사말" tab — the user's own greeting, editable in a modal. */
export function ProfilePanel() {
  const { profile, updateProfile } = useTasteData();
  const { isOwner } = useAuth();
  const [editing, setEditing] = useState(false);

  return (
    <section
      aria-label="인사말"
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 rounded-3xl border border-line bg-paper/70 px-6 py-12 text-center shadow-sm sm:px-12"
    >
      {profile.bio ? (
        <p className="max-w-prose font-serif text-2xl leading-relaxed text-ink sm:text-3xl">
          {profile.bio}
        </p>
      ) : (
        <p className="font-serif text-xl text-ink-faint">
          {isOwner
            ? "아직 인사말이 없어요. ‘인사말 쓰기’로 적어보세요."
            : "아직 인사말이 없어요."}
        </p>
      )}

      {profile.keywords.length > 0 ? (
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm uppercase tracking-[0.25em] text-ink-faint">
            Taste
          </span>
          <TasteKeywords keywords={profile.keywords} />
        </div>
      ) : null}

      {isOwner ? (
        <Button variant="outline" onClick={() => setEditing(true)}>
          ✎ 인사말 쓰기
        </Button>
      ) : null}

      {editing ? (
        <ProfileEditModal
          profile={profile}
          onSave={(next) => {
            updateProfile(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : null}
    </section>
  );
}
