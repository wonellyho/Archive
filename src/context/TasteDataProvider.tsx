import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";
import type { BoardSettings, Pin } from "../types/pin";
import { DEFAULT_BOARD } from "../types/pin";
import { defaultProfile } from "../services/storageService";
import { getRepository } from "../services/repository";
import type { TasteRepository } from "../services/repository";
import { ApiError } from "../services/apiClient";
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
    console.error("Failed to save data:", error);
  });
}

interface TasteDataProviderProps {
  children: ReactNode;
  /**
   * Overrides which repository to load/save through. Defaults to
   * `getRepository()` (my own data — Supabase/API/localStorage per config).
   * `/u/:username` passes `publicRepository(username)` instead so the same
   * provider can serve a read-only view of someone else's archive.
   */
  repository?: TasteRepository;
}

/**
 * Loads taste data from the active repository (Supabase or localStorage) on
 * mount. Mutations update local state immediately (optimistic) and persist in
 * the background, so the UI stays snappy and the call sites stay synchronous.
 */
export function TasteDataProvider({ children, repository }: TasteDataProviderProps) {
  const repo = useRef(repository ?? getRepository());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [musicFolders, setMusicFolders] = useState<TasteFolder[]>([]);
  const [videoFolders, setVideoFolders] = useState<TasteFolder[]>([]);
  const [musicContents, setMusicContents] = useState<TasteContent[]>([]);
  const [videoContents, setVideoContents] = useState<TasteContent[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinBoard, setPinBoard] = useState<BoardSettings>(DEFAULT_BOARD);

  // Latest-state snapshot so mutations can compute next values without putting
  // side effects inside setState updaters (which run twice under StrictMode).
  const snapshot = useRef({
    musicFolders,
    videoFolders,
    musicContents,
    videoContents,
    pins,
    pinBoard,
  });
  snapshot.current = {
    musicFolders,
    videoFolders,
    musicContents,
    videoContents,
    pins,
    pinBoard,
  };

  useEffect(() => {
    // Re-point the ref whenever the `repository` prop changes (e.g. `/u/:username`
    // navigating to a different username) so the useCallbacks below — which read
    // `repo.current` fresh despite empty deps — always persist through the right
    // backend. For the default ("mine") case `repository` is always undefined, so
    // this runs once on mount exactly like before.
    repo.current = repository ?? getRepository();
    let cancelled = false;
    setLoading(true);
    setError(null);
    repo.current
      .loadAll()
      .then((data) => {
        if (cancelled) return;
        setProfile(data.profile);
        setMusicFolders(data.musicFolders);
        setVideoFolders(data.videoFolders);
        setMusicContents(data.musicContents);
        setVideoContents(data.videoContents);
        setPins(data.pins);
        setPinBoard(data.pinBoard);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? "User not found."
            : "Failed to load data. Please try again shortly.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const updateProfile = useCallback(async (next: Profile) => {
    // Non-optimistic: await first so a rejected save (username 409/422) leaves
    // local state untouched and the caller can show the error.
    await repo.current.saveProfile(next);
    setProfile(next);
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

  const reorderFolder = useCallback(
    (type: ContentType, orderedIds: string[]) => {
      const current =
        type === "music"
          ? snapshot.current.musicFolders
          : snapshot.current.videoFolders;
      // Reuse the existing sortOrder values (ascending) so the folders simply
      // swap positions; other data is untouched.
      const pool = orderedIds
        .map((id) => current.find((f) => f.id === id)?.sortOrder)
        .filter((n): n is number => n !== undefined)
        .sort((a, b) => a - b);
      const nextSort = new Map<string, number>();
      orderedIds.forEach((id, i) => {
        if (pool[i] !== undefined) nextSort.set(id, pool[i]);
      });

      setFolders(type)((prev) =>
        prev
          .map((f) => {
            const s = nextSort.get(f.id);
            return s !== undefined ? { ...f, sortOrder: s } : f;
          })
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );

      orderedIds.forEach((id) => {
        const f = current.find((x) => x.id === id);
        const s = nextSort.get(id);
        if (f && s !== undefined && f.sortOrder !== s) {
          persist(repo.current.updateFolder(type, id, { sortOrder: s }));
        }
      });
    },
    [],
  );

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

  const reorderContent = useCallback(
    (type: ContentType, orderedIds: string[]) => {
      const current =
        type === "music"
          ? snapshot.current.musicContents
          : snapshot.current.videoContents;
      // Reuse the folder's own sortOrder values (ascending) so other folders and
      // the global ordering stay untouched — only these cards swap positions.
      const pool = orderedIds
        .map((id) => current.find((c) => c.id === id)?.sortOrder)
        .filter((n): n is number => n !== undefined)
        .sort((a, b) => a - b);
      const nextSort = new Map<string, number>();
      orderedIds.forEach((id, i) => {
        if (pool[i] !== undefined) nextSort.set(id, pool[i]);
      });

      setContents(type)((prev) =>
        prev.map((c) => {
          const s = nextSort.get(c.id);
          return s !== undefined ? { ...c, sortOrder: s } : c;
        }),
      );

      orderedIds.forEach((id) => {
        const c = current.find((x) => x.id === id);
        const s = nextSort.get(id);
        if (c && s !== undefined && c.sortOrder !== s) {
          persist(repo.current.updateContent(type, id, { sortOrder: s }));
        }
      });
    },
    [],
  );

  const hasContent = useCallback(
    (type: ContentType, youtubeVideoId: string) => {
      const list = type === "music" ? musicContents : videoContents;
      return list.some((c) => c.youtubeVideoId === youtubeVideoId);
    },
    [musicContents, videoContents],
  );

  const savePinBoard = useCallback((board: BoardSettings) => {
    setPinBoard(board);
    persist(repo.current.savePinBoard(board));
  }, []);

  const addPin = useCallback((pin: Pin) => {
    setPins((current) => [...current, pin]);
    persist(repo.current.addPin(pin));
  }, []);

  const updatePin = useCallback((pinId: string, patch: Partial<Pin>) => {
    setPins((current) =>
      current.map((pin) => (pin.id === pinId ? { ...pin, ...patch } : pin)),
    );
    persist(repo.current.updatePin(pinId, patch));
  }, []);

  const deletePin = useCallback((pinId: string) => {
    setPins((current) => current.filter((pin) => pin.id !== pinId));
    persist(repo.current.deletePin(pinId));
  }, []);

  const value = useMemo<TasteDataValue>(
    () => ({
      loading,
      error,
      profile,
      musicFolders,
      videoFolders,
      musicContents,
      videoContents,
      pins,
      pinBoard,
      updateProfile,
      addFolder,
      updateFolder,
      deleteFolder,
      reorderFolder,
      addContent,
      updateContent,
      deleteContent,
      reorderContent,
      hasContent,
      savePinBoard,
      addPin,
      updatePin,
      deletePin,
    }),
    [
      loading,
      error,
      profile,
      musicFolders,
      videoFolders,
      musicContents,
      videoContents,
      pins,
      pinBoard,
      updateProfile,
      addFolder,
      updateFolder,
      deleteFolder,
      reorderFolder,
      addContent,
      updateContent,
      deleteContent,
      reorderContent,
      hasContent,
      savePinBoard,
      addPin,
      updatePin,
      deletePin,
    ],
  );

  return (
    <TasteDataContext.Provider value={value}>
      {children}
    </TasteDataContext.Provider>
  );
}
