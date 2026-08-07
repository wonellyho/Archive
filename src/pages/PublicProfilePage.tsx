import { useState } from "react";
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

type TabId = "about" | "tv" | "vinyl" | "timeline";

const TABS: TabItem<TabId>[] = [
  { id: "about", label: "인사말", icon: "✎" },
  { id: "vinyl", label: "바이닐", icon: "🎵" },
  { id: "tv", label: "비디오", icon: "📺" },
  { id: "timeline", label: "축적", icon: "📈" },
];

export function PublicProfilePage() {
  const { profile, loading } = useTasteData();
  const [tab, setTab] = useState<TabId>("about");

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <p className="text-base text-ink-faint">불러오는 중…</p>
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
            actions={<OwnerControls />}
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
