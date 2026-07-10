import { useState } from "react";
import { useTasteData } from "../context/tasteDataContext";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { ProfilePanel } from "../components/profile/ProfilePanel";
import { TabBar } from "../components/layout/TabBar";
import type { TabItem } from "../components/layout/TabBar";
import { TelevisionTab } from "../components/television/TelevisionTab";
import { VinylTab } from "../components/vinyl/VinylTab";
import { MiniPlayer } from "../components/vinyl/MiniPlayer";
import { PlayerProvider } from "../context/PlayerProvider";
import { VideoProvider } from "../context/VideoProvider";
import { OwnerControls } from "../components/auth/OwnerControls";

type TabId = "about" | "tv" | "vinyl";

const TABS: TabItem<TabId>[] = [
  { id: "about", label: "인사말", icon: "✎" },
  { id: "tv", label: "비디오", icon: "📺" },
  { id: "vinyl", label: "바이닐", icon: "🎵" },
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
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-18 px-5 py-12 sm:px-8 sm:py-16">
          <OwnerControls />
          <ProfileHeader profile={profile} />
          <TabBar tabs={TABS} activeId={tab} onChange={setTab} />

          {/* Music & video keep playing across tabs (providers own the players). */}
          {tab === "about" ? <ProfilePanel /> : null}
          {tab === "tv" ? <TelevisionTab /> : null}
          {tab === "vinyl" ? <VinylTab /> : null}
        </main>

        {/* Background music status; appears when the full player isn't on screen. */}
        <MiniPlayer />
      </VideoProvider>
    </PlayerProvider>
  );
}
