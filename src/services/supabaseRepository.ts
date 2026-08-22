import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";
import type { BoardSettings, Pin } from "../types/pin";
import { DEFAULT_BOARD } from "../types/pin";
import type { FolderPatch, ContentPatch } from "../context/tasteDataContext";
import type { RepoData, TasteRepository } from "./repository";
import { supabase } from "./supabaseClient";
import { defaultProfile } from "./storageService";

const PROFILE_ID = "me";
const PIN_STORAGE_KEY = "taste:v3:pins";
const PIN_BOARD_KEY = "taste:v3:board";

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

interface PinRow {
  id: string;
  user_id: string;
  images: string[];
  aspect_ratio: number | null;
  title: string | null;
  subtitle: string | null;
  photo_texts: Pin["photoTexts"] | null;
  detail_spacing: number;
  content: string;
  format: Pin["format"];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  decoration: Pin["decoration"];
  pin_color: Pin["pinColor"] | null;
  text_style: Pin["textStyle"];
  variant: Pin["variant"];
  created_at: string;
}

interface PinBoardRow {
  user_id: string;
  width_pct: number;
  aspect: number;
  opacity: number;
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

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

function isDefaultBoard(board: BoardSettings): boolean {
  return (
    board.widthPct === DEFAULT_BOARD.widthPct &&
    board.aspect === DEFAULT_BOARD.aspect &&
    board.opacity === DEFAULT_BOARD.opacity
  );
}

function isMissingPinboardTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === "PGRST205" ||
        error.message?.includes("relation") && error.message.includes("does not exist")),
  );
}

function toPin(row: PinRow): Pin {
  return {
    id: row.id,
    images: row.images ?? [],
    aspectRatio: row.aspect_ratio ?? undefined,
    title: row.title ?? undefined,
    subtitle: row.subtitle ?? undefined,
    photoTexts: row.photo_texts ?? [],
    detailSpacing: row.detail_spacing ?? 1,
    content: row.content ?? "",
    format: row.format,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    z: row.z,
    decoration: row.decoration,
    pinColor: row.pin_color ?? undefined,
    textStyle: row.text_style,
    variant: row.variant,
    createdAt: row.created_at,
  };
}

function pinRow(pin: Pin, userId: string): PinRow {
  return {
    id: pin.id,
    user_id: userId,
    images: pin.images,
    aspect_ratio: pin.aspectRatio ?? null,
    title: pin.title ?? null,
    subtitle: pin.subtitle ?? null,
    photo_texts: pin.photoTexts ?? [],
    detail_spacing: pin.detailSpacing ?? 1,
    content: pin.content,
    format: pin.format,
    x: pin.x,
    y: pin.y,
    width: pin.width,
    height: pin.height,
    rotation: pin.rotation,
    z: pin.z,
    decoration: pin.decoration,
    pin_color: pin.pinColor ?? null,
    text_style: pin.textStyle,
    variant: pin.variant,
    created_at: pin.createdAt,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error("You must be logged in to edit the pinboard.");
  return data.user.id;
}

async function migrateLocalPinboard(
  remotePins: Pin[],
  remoteBoard: PinBoardRow | null,
): Promise<{ pins: Pin[]; board: BoardSettings }> {
  const localPins = getLocalPins();
  const localBoard = getLocalPinBoard();
  if (remotePins.length > 0 && remoteBoard) {
    return { pins: remotePins, board: {
      widthPct: remoteBoard.width_pct,
      aspect: remoteBoard.aspect,
      opacity: remoteBoard.opacity,
    } };
  }

  const db = client();
  const { data } = await db.auth.getUser();
  if (!data.user) return { pins: remotePins, board: localBoard };

  try {
    if (remotePins.length === 0 && localPins.length > 0) {
      const { error } = await db
        .from("pins")
        .upsert(localPins.map((pin) => pinRow(pin, data.user.id)), { onConflict: "id" });
      if (error) throw error;
    }
    if (!remoteBoard && !isDefaultBoard(localBoard)) {
      const { error } = await db.from("pin_boards").upsert(
        {
          user_id: data.user.id,
          width_pct: localBoard.widthPct,
          aspect: localBoard.aspect,
          opacity: localBoard.opacity,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    }
  } catch (error) {
    console.warn("Pinboard migration from local storage failed:", error);
  }

  return {
    pins: remotePins.length > 0 ? remotePins : localPins,
    board: remoteBoard
      ? {
          widthPct: remoteBoard.width_pct,
          aspect: remoteBoard.aspect,
          opacity: remoteBoard.opacity,
        }
      : localBoard,
  };
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
    const [profileRes, foldersRes, contentsRes, pinsRes, boardRes] = await Promise.all([
      db.from("profiles").select("*").eq("id", PROFILE_ID).maybeSingle(),
      db.from("folders").select("*").order("sort_order"),
      db.from("contents").select("*").order("sort_order"),
      db.from("pins").select("*").order("z", { ascending: true }).order("created_at", { ascending: true }),
      db.from("pin_boards").select("width_pct, aspect, opacity").maybeSingle(),
    ]);

    if (foldersRes.error) throw new Error(foldersRes.error.message);
    if (contentsRes.error) throw new Error(contentsRes.error.message);
    const pinboardTablesReady =
      !isMissingPinboardTable(pinsRes.error) && !isMissingPinboardTable(boardRes.error);
    if (pinboardTablesReady && (pinsRes.error || boardRes.error)) {
      throw new Error((pinsRes.error ?? boardRes.error)?.message ?? "Failed to load pinboard.");
    }

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

    const remotePins = pinboardTablesReady
      ? ((pinsRes.data as PinRow[] | null) ?? []).map(toPin)
      : [];
    const remoteBoard = pinboardTablesReady
      ? ((boardRes.data as PinBoardRow | null) ?? null)
      : null;
    const pinboard = pinboardTablesReady
      ? await migrateLocalPinboard(remotePins, remoteBoard)
      : { pins: getLocalPins(), board: getLocalPinBoard() };

    return {
      profile,
      musicFolders: folders.filter((f) => f.type === "music"),
      videoFolders: folders.filter((f) => f.type === "video"),
      musicContents: contents.filter((c) => c.type === "music"),
      videoContents: contents.filter((c) => c.type === "video"),
      pins: pinboard.pins,
      pinBoard: pinboard.board,
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
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    const { error } = await client().from("contents").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async deleteContent(_type: ContentType, id: string): Promise<void> {
    const { error } = await client().from("contents").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async savePinBoard(board: BoardSettings): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client()
      .from("pin_boards")
      .upsert(
        { user_id: userId, ...board, width_pct: board.widthPct },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    localStorage.setItem(PIN_BOARD_KEY, JSON.stringify(board));
  },

  async addPin(pin: Pin): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client().from("pins").insert(pinRow(pin, userId));
    if (error) throw new Error(error.message);
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...getLocalPins(), pin]));
  },

  async updatePin(id: string, patch: Partial<Pin>): Promise<void> {
    const userId = await currentUserId();
    const row: Record<string, unknown> = {};
    if (patch.images !== undefined) row.images = patch.images;
    if (patch.aspectRatio !== undefined) row.aspect_ratio = patch.aspectRatio;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.subtitle !== undefined) row.subtitle = patch.subtitle;
    if (patch.photoTexts !== undefined) row.photo_texts = patch.photoTexts;
    if (patch.detailSpacing !== undefined) row.detail_spacing = patch.detailSpacing;
    if (patch.content !== undefined) row.content = patch.content;
    if (patch.format !== undefined) row.format = patch.format;
    if (patch.x !== undefined) row.x = patch.x;
    if (patch.y !== undefined) row.y = patch.y;
    if (patch.width !== undefined) row.width = patch.width;
    if (patch.height !== undefined) row.height = patch.height;
    if (patch.rotation !== undefined) row.rotation = patch.rotation;
    if (patch.z !== undefined) row.z = patch.z;
    if (patch.decoration !== undefined) row.decoration = patch.decoration;
    if (patch.pinColor !== undefined) row.pin_color = patch.pinColor;
    if (patch.textStyle !== undefined) row.text_style = patch.textStyle;
    if (patch.variant !== undefined) row.variant = patch.variant;
    if (Object.keys(row).length > 0) {
      const { error } = await client().from("pins").update(row).eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    localStorage.setItem(
      PIN_STORAGE_KEY,
      JSON.stringify(getLocalPins().map((pin) => (pin.id === id ? { ...pin, ...patch } : pin))),
    );
  },

  async deletePin(id: string): Promise<void> {
    const userId = await currentUserId();
    const { error } = await client().from("pins").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    localStorage.setItem(
      PIN_STORAGE_KEY,
      JSON.stringify(getLocalPins().filter((pin) => pin.id !== id)),
    );
  },
};
