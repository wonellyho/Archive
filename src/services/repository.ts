import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";
import type { BoardSettings, Pin } from "../types/pin";
import { DEFAULT_BOARD } from "../types/pin";
import type { FolderPatch, ContentPatch } from "../context/tasteDataContext";
import { localTasteStorage } from "./storageService";
import { isSupabaseConfigured } from "./supabaseClient";
import { supabaseRepository } from "./supabaseRepository";
import { apiRepository } from "./apiRepository";
import { isApiConfigured } from "./apiClient";

export interface RepoData {
  profile: Profile;
  musicFolders: TasteFolder[];
  videoFolders: TasteFolder[];
  musicContents: TasteContent[];
  videoContents: TasteContent[];
  pins: Pin[];
  pinBoard: BoardSettings;
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
  savePinBoard(board: BoardSettings): Promise<void>;
  addPin(pin: Pin): Promise<void>;
  updatePin(id: string, patch: Partial<Pin>): Promise<void>;
  deletePin(id: string): Promise<void>;
}

const PIN_STORAGE_KEY = "taste:v3:pins";
const PIN_BOARD_KEY = "taste:v3:board";

function getLocalPins(): Pin[] {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Pin[]) : [];
  } catch {
    return [];
  }
}

function getLocalPinBoard(): BoardSettings {
  try {
    const raw = localStorage.getItem(PIN_BOARD_KEY);
    return raw ? { ...DEFAULT_BOARD, ...(JSON.parse(raw) as Partial<BoardSettings>) } : DEFAULT_BOARD;
  } catch {
    return DEFAULT_BOARD;
  }
}

const localRepository: TasteRepository = {
  loadAll() {
    return Promise.resolve({
      profile: localTasteStorage.getProfile(),
      musicFolders: localTasteStorage.getFolders("music"),
      videoFolders: localTasteStorage.getFolders("video"),
      musicContents: localTasteStorage.getContents("music"),
      videoContents: localTasteStorage.getContents("video"),
      pins: getLocalPins(),
      pinBoard: getLocalPinBoard(),
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
  savePinBoard(board) {
    localStorage.setItem(PIN_BOARD_KEY, JSON.stringify(board));
    return Promise.resolve();
  },
  addPin(pin) {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...getLocalPins(), pin]));
    return Promise.resolve();
  },
  updatePin(id, patch) {
    localStorage.setItem(
      PIN_STORAGE_KEY,
      JSON.stringify(getLocalPins().map((pin) => (pin.id === id ? { ...pin, ...patch } : pin))),
    );
    return Promise.resolve();
  },
  deletePin(id) {
    localStorage.setItem(
      PIN_STORAGE_KEY,
      JSON.stringify(getLocalPins().filter((pin) => pin.id !== id)),
    );
    return Promise.resolve();
  },
};

export function getRepository(): TasteRepository {
  // 백엔드 API가 설정되면 읽기·쓰기 전부 API 경유(P4 완료).
  // 쓰기 인증 토큰 발급에 Supabase 로그인이 필요하므로 Supabase 설정도 함께 요구한다.
  if (isApiConfigured && isSupabaseConfigured) return apiRepository;
  return isSupabaseConfigured ? supabaseRepository : localRepository;
}
