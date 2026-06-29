import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";

/**
 * Storage abstraction. Swapping localStorage for Supabase later only requires a
 * new implementation of this interface — callers never touch the backend directly.
 */
export interface TasteStorage {
  getProfile(): Profile;
  saveProfile(profile: Profile): void;
  getFolders(type: ContentType): TasteFolder[];
  saveFolders(type: ContentType, folders: TasteFolder[]): void;
  getContents(type: ContentType): TasteContent[];
  saveContents(type: ContentType, contents: TasteContent[]): void;
}

// Bump the version when the stored shape changes to discard incompatible data.
const NS = "taste:v2";
const KEYS = {
  profile: `${NS}:profile`,
  folders: (type: ContentType) => `${NS}:folders:${type}`,
  contents: (type: ContentType) => `${NS}:contents:${type}`,
} as const;

/** Neutral starting profile (no mock content). */
export const defaultProfile: Profile = {
  name: "My Archive",
  tagline: "Things I keep returning to.",
  bio: "",
  keywords: [],
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted JSON or storage unavailable — fall back to defaults.
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage unavailable — fail silently for the MVP.
  }
}

export const localTasteStorage: TasteStorage = {
  getProfile() {
    return read<Profile>(KEYS.profile, defaultProfile);
  },
  saveProfile(profile) {
    write(KEYS.profile, profile);
  },
  getFolders(type) {
    return read<TasteFolder[]>(KEYS.folders(type), []);
  },
  saveFolders(type, folders) {
    write(KEYS.folders(type), folders);
  },
  getContents(type) {
    return read<TasteContent[]>(KEYS.contents(type), []);
  },
  saveContents(type, contents) {
    write(KEYS.contents(type), contents);
  },
};
