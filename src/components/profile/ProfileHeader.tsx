import type { Profile } from "../../types/profile";

interface ProfileHeaderProps {
  profile: Profile;
}

/** Compact site header shown above the tabs on every view. */
export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {profile.profileImageUrl ? (
        <img
          src={profile.profileImageUrl}
          alt={`${profile.name} profile`}
          className="size-20 rounded-full object-cover shadow-sm"
        />
      ) : null}
      <h1 className="font-serif text-5xl font-medium tracking-tight sm:text-6xl">
        {profile.name}
      </h1>
      <p className="text-lg text-ink-soft">{profile.tagline}</p>
    </header>
  );
}
