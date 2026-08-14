import { useState } from "react";
import { Link } from "react-router-dom";
import { useTasteData } from "../context/tasteDataContext";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { ProfilePanel } from "../components/profile/ProfilePanel";
import { SiteNav } from "../components/layout/SiteNav";
import type { TabItem } from "../components/layout/SiteNav";
import { TelevisionTab } from "../components/television/TelevisionTab";
import { VinylTab } from "../components/vinyl/VinylTab";
import { TasteTimeline } from "../components/profile/TasteTimeline";
import { PlaybackDock } from "../components/common/PlaybackDock";
import { PlayerProvider } from "../context/PlayerProvider";
import { VideoProvider } from "../context/VideoProvider";
import { OwnerControls } from "../components/auth/OwnerControls";
import { BackgroundPicker } from "../components/common/BackgroundPicker";

type TabId = "about" | "tv" | "vinyl" | "timeline";

const TABS: TabItem<TabId>[] = [
  { id: "about", label: "About", icon: "✎" },
  { id: "vinyl", label: "Vinyl", icon: "🎵" },
  { id: "tv", label: "Video", icon: "📺" },
  { id: "timeline", label: "Timeline", icon: "📈" },
];

interface PublicProfilePageProps {
  /**
   * True on `/u/:username` (#66) — someone else's shared archive. Swaps the
   * owner login/edit chip for a growth CTA back to `/`, since editing only
   * ever happens on your own home (isOwner is already forced false upstream
   * by AuthProvider's forceReadOnly, so no owner-only buttons render either
   * way — this just replaces the nav slot with something useful instead).
   */
  readOnly?: boolean;
}

export function PublicProfilePage({ readOnly = false }: PublicProfilePageProps) {
  const { profile, loading, error } = useTasteData();
  const [tab, setTab] = useState<TabId>("about");

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <p className="text-base text-ink-faint">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <p className="text-base text-ink-soft">{error}</p>
        <Link to="/" className="text-sm text-accent hover:underline">
          ← Home
        </Link>
      </main>
    );
  }

  return (
    <PlayerProvider>
      <VideoProvider>
        <div className="flex min-h-svh flex-col">
          <SiteNav
            brand={profile.name}
            tabs={TABS}
            activeId={tab}
            onChange={setTab}
            actions={
              readOnly ? (
                <Link
                  to="/"
                  className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-cream"
                >
                  Create your own archive →
                </Link>
              ) : (
                <div className="flex items-center gap-1.5">
                  <BackgroundPicker />
                  <OwnerControls />
                </div>
              )
            }
          />

          <main className="mx-auto flex w-full max-w-375 flex-1 flex-col gap-12 px-5 py-10 sm:px-10 sm:py-14">
            {/* Greeting keeps a centered hero; the shelves fill the width. */}
            {tab === "about" ? (
              <div className="flex flex-col items-center gap-12 py-8 sm:py-12">
                <ProfileHeader profile={profile} />
                <ProfilePanel />
              </div>
            ) : null}
            {tab === "vinyl" ? <VinylTab /> : null}
            {tab === "tv" ? <TelevisionTab /> : null}
            {tab === "timeline" ? (
              <TasteTimeline username={profile.username} />
            ) : null}
          </main>
        </div>

        {/* Background players (music + video) stacked bottom-right. */}
        <PlaybackDock />
      </VideoProvider>
    </PlayerProvider>
  );
}
