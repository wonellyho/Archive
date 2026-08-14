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
      aria-label="About"
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-10 text-center"
    >
      {profile.bio ? (
        <blockquote className="relative max-w-prose px-4">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-1 -top-8 select-none font-serif text-7xl leading-none text-ink/10 sm:-left-4"
          >
            &ldquo;
          </span>
          <p className="whitespace-pre-line font-serif text-2xl leading-relaxed text-ink sm:text-[1.9rem]">
            {profile.bio}
          </p>
        </blockquote>
      ) : (
        <p className="font-serif text-xl italic text-ink-faint">
          {isOwner
            ? "No greeting yet. Try 'Write a greeting'."
            : "No greeting yet."}
        </p>
      )}

      {profile.keywords.length > 0 ? (
        <div className="flex flex-col items-center gap-4">
          <span className="text-xs uppercase tracking-[0.35em] text-ink-faint">
            Taste
          </span>
          <TasteKeywords keywords={profile.keywords} />
        </div>
      ) : null}

      {isOwner ? (
        <Button variant="ghost" onClick={() => setEditing(true)}>
          ✎ Write a greeting
        </Button>
      ) : null}

      {editing ? (
        <ProfileEditModal
          profile={profile}
          onSave={updateProfile}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </section>
  );
}
