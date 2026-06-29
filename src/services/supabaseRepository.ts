import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";
import type { FolderPatch, ContentPatch } from "../context/tasteDataContext";
import type { RepoData, TasteRepository } from "./repository";
import { supabase } from "./supabaseClient";
import { defaultProfile } from "./storageService";

const PROFILE_ID = "me";

interface ProfileRow {
  id: string;
  name: string;
  tagline: string;
  bio: string;
  keywords: string[] | null;
  profile_image_url: string | null;
}

interface FolderRow {
  id: string;
  type: ContentType;
  name: string;
  cover_image_url: string | null;
  sort_order: number;
  created_at: string;
}

interface ContentRow {
  id: string;
  type: ContentType;
  folder_id: string | null;
  youtube_video_id: string;
  source_title: string;
  source_channel: string;
  thumbnail_url: string;
  title: string;
  subtitle: string;
  body: string;
  sort_order: number;
  created_at: string;
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function toFolder(row: FolderRow): TasteFolder {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    coverImageUrl: row.cover_image_url ?? undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function toContent(row: ContentRow): TasteContent {
  return {
    id: row.id,
    type: row.type,
    folderId: row.folder_id,
    youtubeVideoId: row.youtube_video_id,
    sourceTitle: row.source_title,
    sourceChannel: row.source_channel,
    thumbnailUrl: row.thumbnail_url,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function folderRow(folder: TasteFolder): FolderRow {
  return {
    id: folder.id,
    type: folder.type,
    name: folder.name,
    cover_image_url: folder.coverImageUrl ?? null,
    sort_order: folder.sortOrder,
    created_at: folder.createdAt,
  };
}

function contentRow(content: TasteContent): ContentRow {
  return {
    id: content.id,
    type: content.type,
    folder_id: content.folderId,
    youtube_video_id: content.youtubeVideoId,
    source_title: content.sourceTitle,
    source_channel: content.sourceChannel,
    thumbnail_url: content.thumbnailUrl,
    title: content.title,
    subtitle: content.subtitle,
    body: content.body,
    sort_order: content.sortOrder,
    created_at: content.createdAt,
  };
}

export const supabaseRepository: TasteRepository = {
  async loadAll(): Promise<RepoData> {
    const db = client();
    const [profileRes, foldersRes, contentsRes] = await Promise.all([
      db.from("profiles").select("*").eq("id", PROFILE_ID).maybeSingle(),
      db.from("folders").select("*").order("sort_order"),
      db.from("contents").select("*").order("sort_order"),
    ]);

    if (foldersRes.error) throw new Error(foldersRes.error.message);
    if (contentsRes.error) throw new Error(contentsRes.error.message);

    const profileRow = profileRes.data as ProfileRow | null;
    const profile: Profile = profileRow
      ? {
          name: profileRow.name,
          tagline: profileRow.tagline,
          bio: profileRow.bio,
          keywords: profileRow.keywords ?? [],
          profileImageUrl: profileRow.profile_image_url ?? undefined,
        }
      : defaultProfile;

    const folders = ((foldersRes.data as FolderRow[] | null) ?? []).map(toFolder);
    const contents = ((contentsRes.data as ContentRow[] | null) ?? []).map(
      toContent,
    );

    return {
      profile,
      musicFolders: folders.filter((f) => f.type === "music"),
      videoFolders: folders.filter((f) => f.type === "video"),
      musicContents: contents.filter((c) => c.type === "music"),
      videoContents: contents.filter((c) => c.type === "video"),
    };
  },

  async saveProfile(profile: Profile): Promise<void> {
    const { error } = await client()
      .from("profiles")
      .upsert({
        id: PROFILE_ID,
        name: profile.name,
        tagline: profile.tagline,
        bio: profile.bio,
        keywords: profile.keywords,
        profile_image_url: profile.profileImageUrl ?? null,
      });
    if (error) throw new Error(error.message);
  },

  async addFolder(folder: TasteFolder): Promise<void> {
    const { error } = await client().from("folders").insert(folderRow(folder));
    if (error) throw new Error(error.message);
  },

  async updateFolder(
    _type: ContentType,
    id: string,
    patch: FolderPatch,
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if ("coverImageUrl" in patch) row.cover_image_url = patch.coverImageUrl ?? null;
    const { error } = await client().from("folders").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async deleteFolder(_type: ContentType, id: string): Promise<void> {
    const db = client();
    const contentsRes = await db.from("contents").delete().eq("folder_id", id);
    if (contentsRes.error) throw new Error(contentsRes.error.message);
    const foldersRes = await db.from("folders").delete().eq("id", id);
    if (foldersRes.error) throw new Error(foldersRes.error.message);
  },

  async addContent(content: TasteContent): Promise<void> {
    const { error } = await client()
      .from("contents")
      .insert(contentRow(content));
    if (error) throw new Error(error.message);
  },

  async updateContent(
    _type: ContentType,
    id: string,
    patch: ContentPatch,
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.subtitle !== undefined) row.subtitle = patch.subtitle;
    if (patch.body !== undefined) row.body = patch.body;
    const { error } = await client().from("contents").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async deleteContent(_type: ContentType, id: string): Promise<void> {
    const { error } = await client().from("contents").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
