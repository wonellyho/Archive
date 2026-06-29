import type { ContentType } from "./content";

export interface TasteFolder {
  id: string;
  name: string;
  type: ContentType;
  /** Optional cover image (data URL) shown on the folder tile. */
  coverImageUrl?: string;
  sortOrder: number;
  createdAt: string;
}
