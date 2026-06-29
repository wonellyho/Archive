import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";
import { defaultProfile } from "../services/storageService";
import { getRepository } from "../services/repository";
import { TasteDataContext } from "./tasteDataContext";
import type {
  ContentPatch,
  FolderPatch,
  NewContentInput,
  TasteDataValue,
} from "./tasteDataContext";

function nextSortOrder(items: { sortOrder: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Fire-and-forget persistence; surfaces backend errors without crashing the UI. */
function persist(promise: Promise<void>): void {
  promise.catch((error: unknown) => {
    console.error("데이터 저장에 실패했습니다:", error);
  });
}

/**
 * Loads taste data from the active repository (Supabase or localStorage) on
 * mount. Mutations update local state immediately (optimistic) and persist in
 * the background, so the UI stays snappy and the call sites stay synchronous.
 */
export function TasteDataProvider({ children }: { children: ReactNode }) {
  const repo = useRef(getRepository());
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [musicFolders, setMusicFolders] = useState<TasteFolder[]>([]);
  const [videoFolders, setVideoFolders] = useState<TasteFolder[]>([]);
  const [musicContents, setMusicContents] = useState<TasteContent[]>([]);
  const [videoContents, setVideoContents] = useState<TasteContent[]>([]);

  // Latest-state snapshot so mutations can compute next values without putting
  // side effects inside setState updaters (which run twice under StrictMode).
  const snapshot = useRef({
    musicFolders,
    videoFolders,
    musicContents,
    videoContents,
  });
  snapshot.current = {
    musicFolders,
    videoFolders,
    musicContents,
    videoContents,
  };

  useEffect(() => {
    let cancelled = false;
    repo.current
      .loadAll()
      .then((data) => {
        if (cancelled) return;
        setProfile(data.profile);
        setMusicFolders(data.musicFolders);
        setVideoFolders(data.videoFolders);
        setMusicContents(data.musicContents);
        setVideoContents(data.videoContents);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProfile = useCallback((next: Profile) => {
    setProfile(next);
    persist(repo.current.saveProfile(next));
  }, []);

  const setFolders = (type: ContentType) =>
    type === "music" ? setMusicFolders : setVideoFolders;
  const setContents = (type: ContentType) =>
    type === "music" ? setMusicContents : setVideoContents;

  const addFolder = useCallback(
    (type: ContentType, name: string, coverImageUrl?: string) => {
      const current =
        type === "music"
          ? snapshot.current.musicFolders
          : snapshot.current.videoFolders;
      const folder: TasteFolder = {
        id: createId(),
        name: name.trim(),
        type,
        coverImageUrl,
        sortOrder: nextSortOrder(current),
        createdAt: new Date().toISOString(),
      };
      setFolders(type)([...current, folder]);
      persist(repo.current.addFolder(folder));
      return folder;
    },
    [],
  );

  const updateFolder = useCallback(
    (type: ContentType, folderId: string, patch: FolderPatch) => {
      setFolders(type)((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, ...patch } : f)),
      );
      persist(repo.current.updateFolder(type, folderId, patch));
    },
    [],
  );

  const deleteFolder = useCallback((type: ContentType, folderId: string) => {
    setFolders(type)((prev) => prev.filter((f) => f.id !== folderId));
    setContents(type)((prev) => prev.filter((c) => c.folderId !== folderId));
    persist(repo.current.deleteFolder(type, folderId));
  }, []);

  const addContent = useCallback((input: NewContentInput) => {
    const current =
      input.type === "music"
        ? snapshot.current.musicContents
        : snapshot.current.videoContents;
    const content: TasteContent = {
      id: createId(),
      sortOrder: nextSortOrder(current),
      createdAt: new Date().toISOString(),
      ...input,
    };
    setContents(input.type)([...current, content]);
    persist(repo.current.addContent(content));
    return content;
  }, []);

  const updateContent = useCallback(
    (type: ContentType, contentId: string, patch: ContentPatch) => {
      setContents(type)((prev) =>
        prev.map((c) => (c.id === contentId ? { ...c, ...patch } : c)),
      );
      persist(repo.current.updateContent(type, contentId, patch));
    },
    [],
  );

  const deleteContent = useCallback((type: ContentType, contentId: string) => {
    setContents(type)((prev) => prev.filter((c) => c.id !== contentId));
    persist(repo.current.deleteContent(type, contentId));
  }, []);

  const hasContent = useCallback(
    (type: ContentType, youtubeVideoId: string) => {
      const list = type === "music" ? musicContents : videoContents;
      return list.some((c) => c.youtubeVideoId === youtubeVideoId);
    },
    [musicContents, videoContents],
  );

  const value = useMemo<TasteDataValue>(
    () => ({
      loading,
      profile,
      musicFolders,
      videoFolders,
      musicContents,
      videoContents,
      updateProfile,
      addFolder,
      updateFolder,
      deleteFolder,
      addContent,
      updateContent,
      deleteContent,
      hasContent,
    }),
    [
      loading,
      profile,
      musicFolders,
      videoFolders,
      musicContents,
      videoContents,
      updateProfile,
      addFolder,
      updateFolder,
      deleteFolder,
      addContent,
      updateContent,
      deleteContent,
      hasContent,
    ],
  );

  return (
    <TasteDataContext.Provider value={value}>
      {children}
    </TasteDataContext.Provider>
  );
}
