import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";
import type { FolderPatch, ContentPatch } from "../context/tasteDataContext";
import { localTasteStorage } from "./storageService";
import { isSupabaseConfigured } from "./supabaseClient";
import { supabaseRepository } from "./supabaseRepository";

export interface RepoData {
  profile: Profile;
  musicFolders: TasteFolder[];
  videoFolders: TasteFolder[];
  musicContents: TasteContent[];
  videoContents: TasteContent[];
}

/**
 * Async data access. localStorage and Supabase both implement this so the
 * provider can stay backend-agnostic.
 */
export interface TasteRepository {
  loadAll(): Promise<RepoData>;
  saveProfile(profile: Profile): Promise<void>;
  addFolder(folder: TasteFolder): Promise<void>;
  updateFolder(type: ContentType, id: string, patch: FolderPatch): Promise<void>;
  deleteFolder(type: ContentType, id: string): Promise<void>;
  addContent(content: TasteContent): Promise<void>;
  updateContent(
    type: ContentType,
    id: string,
    patch: ContentPatch,
  ): Promise<void>;
  deleteContent(type: ContentType, id: string): Promise<void>;
}

const localRepository: TasteRepository = {
  loadAll() {
    return Promise.resolve({
      profile: localTasteStorage.getProfile(),
      musicFolders: localTasteStorage.getFolders("music"),
      videoFolders: localTasteStorage.getFolders("video"),
      musicContents: localTasteStorage.getContents("music"),
      videoContents: localTasteStorage.getContents("video"),
    });
  },
  saveProfile(profile) {
    localTasteStorage.saveProfile(profile);
    return Promise.resolve();
  },
  addFolder(folder) {
    const next = [...localTasteStorage.getFolders(folder.type), folder];
    localTasteStorage.saveFolders(folder.type, next);
    return Promise.resolve();
  },
  updateFolder(type, id, patch) {
    const next = localTasteStorage
      .getFolders(type)
      .map((f) => (f.id === id ? { ...f, ...patch } : f));
    localTasteStorage.saveFolders(type, next);
    return Promise.resolve();
  },
  deleteFolder(type, id) {
    localTasteStorage.saveFolders(
      type,
      localTasteStorage.getFolders(type).filter((f) => f.id !== id),
    );
    localTasteStorage.saveContents(
      type,
      localTasteStorage.getContents(type).filter((c) => c.folderId !== id),
    );
    return Promise.resolve();
  },
  addContent(content) {
    const next = [...localTasteStorage.getContents(content.type), content];
    localTasteStorage.saveContents(content.type, next);
    return Promise.resolve();
  },
  updateContent(type, id, patch) {
    const next = localTasteStorage
      .getContents(type)
      .map((c) => (c.id === id ? { ...c, ...patch } : c));
    localTasteStorage.saveContents(type, next);
    return Promise.resolve();
  },
  deleteContent(type, id) {
    localTasteStorage.saveContents(
      type,
      localTasteStorage.getContents(type).filter((c) => c.id !== id),
    );
    return Promise.resolve();
  },
};

export function getRepository(): TasteRepository {
  return isSupabaseConfigured ? supabaseRepository : localRepository;
}
