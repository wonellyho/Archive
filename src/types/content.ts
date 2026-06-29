export type ContentType = "music" | "video";

export interface TasteContent {
  id: string;
  type: ContentType;
  /** null means the content is currently uncategorized. */
  folderId: string | null;
  youtubeVideoId: string;

  /** Attribution pulled from YouTube — shown small as the source. */
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;

  /** User-authored display fields. */
  title: string;
  subtitle: string;
  body: string;

  sortOrder: number;
  createdAt: string;
}
