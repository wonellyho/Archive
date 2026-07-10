import { createContext, useContext } from "react";
import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";

/** Fields needed to register a new piece of content (ids/dates are generated). */
export interface NewContentInput {
  type: ContentType;
  folderId: string | null;
  youtubeVideoId: string;
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;
  title: string;
  subtitle: string;
  body: string;
}

export type FolderPatch = Partial<Pick<TasteFolder, "name" | "coverImageUrl">>;
export type ContentPatch = Partial<
  Pick<TasteContent, "title" | "subtitle" | "body" | "sortOrder">
>;

export interface TasteDataValue {
  /** True while the initial load from the backend is in flight. */
  loading: boolean;
  profile: Profile;
  musicFolders: TasteFolder[];
  videoFolders: TasteFolder[];
  musicContents: TasteContent[];
  videoContents: TasteContent[];
  /** Replace the whole profile and persist it. */
  updateProfile: (profile: Profile) => void;
  /** Create a folder and persist it. Returns the created folder. */
  addFolder: (
    type: ContentType,
    name: string,
    coverImageUrl?: string,
  ) => TasteFolder;
  /** Update a folder's name and/or cover. */
  updateFolder: (type: ContentType, folderId: string, patch: FolderPatch) => void;
  /** Delete a folder and every piece of content inside it. */
  deleteFolder: (type: ContentType, folderId: string) => void;
  /** Register new content and persist it. Returns the created content. */
  addContent: (input: NewContentInput) => TasteContent;
  /** Update a content's user-authored fields. */
  updateContent: (
    type: ContentType,
    contentId: string,
    patch: ContentPatch,
  ) => void;
  /** Delete a single piece of content. */
  deleteContent: (type: ContentType, contentId: string) => void;
  /**
   * Reorder content within a folder. `orderedIds` is the new sequence; the
   * folder's existing sortOrder values are reassigned to match and persisted.
   */
  reorderContent: (type: ContentType, orderedIds: string[]) => void;
  /** True if the same YouTube id is already saved for that content type. */
  hasContent: (type: ContentType, youtubeVideoId: string) => boolean;
}

export const TasteDataContext = createContext<TasteDataValue | null>(null);

export function useTasteData(): TasteDataValue {
  const value = useContext(TasteDataContext);
  if (value === null) {
    throw new Error("useTasteData must be used within a TasteDataProvider");
  }
  return value;
}
