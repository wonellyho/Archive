import type { Profile } from "../../types/profile";

interface ProfileHeaderProps {
  profile: Profile;
}

/** Editorial hero for the greeting tab: kicker, name, tagline, and a hairline. */
export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <header className="flex flex-col items-center gap-4 text-center">
      <span className="text-xs uppercase tracking-[0.4em] text-ink-faint">
        Taste Archive
      </span>
      <h1 className="font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
        {profile.name}
      </h1>
      {profile.tagline ? (
        <p className="font-serif text-lg italic text-ink-soft sm:text-xl">
          {profile.tagline}
        </p>
      ) : null}
      <span aria-hidden="true" className="mt-2 h-px w-14 bg-ink/20" />
    </header>
  );
}
