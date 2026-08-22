import type { Profile } from "../types/profile";
import type { TasteFolder } from "../types/folder";
import type { TasteContent, ContentType } from "../types/content";
import type { BoardSettings, Pin } from "../types/pin";
import { DEFAULT_BOARD } from "../types/pin";
import type { FolderPatch, ContentPatch } from "../context/tasteDataContext";
import type { RepoData, TasteRepository } from "./repository";
import { api, uploadImage } from "./apiClient";
import { dataUrlToBlob } from "../utils/image";

/**
 * FastAPI 백엔드 경유 저장소 — P4: 읽기·쓰기 전부 백엔드 API 모드.
 * (P2의 하이브리드에서 쓰기 7개 메서드를 API 호출로 전환)
 *
 * 롤백: .env에서 VITE_API_URL을 지우면 즉시 기존 Supabase 직행 경로로 복귀한다.
 */

/** 백엔드는 없는 값을 null로 주므로, 기존 loadAll처럼 undefined로 정규화한다. */
function normalize(data: RepoData): RepoData {
  return {
    ...data,
    profile: {
      ...data.profile,
      profileImageUrl: data.profile.profileImageUrl ?? undefined,
    },
    musicFolders: data.musicFolders.map((f) => ({
      ...f,
      coverImageUrl: f.coverImageUrl ?? undefined,
    })),
    videoFolders: data.videoFolders.map((f) => ({
      ...f,
      coverImageUrl: f.coverImageUrl ?? undefined,
    })),
    pins: (data.pins ?? []).map((pin) => ({
      ...pin,
      aspectRatio: pin.aspectRatio ?? undefined,
      title: pin.title ?? undefined,
      subtitle: pin.subtitle ?? undefined,
      pinColor: pin.pinColor ?? undefined,
    })),
    pinBoard: data.pinBoard ?? DEFAULT_BOARD,
  };
}

type PinImagePayload = Pick<Pin, "id" | "images">;

async function uploadInlinePinImages<T extends PinImagePayload>(pin: T): Promise<T> {
  const images = await Promise.all(
    pin.images.map(async (src, i) => {
      if (!src.startsWith("data:")) return src;
      const blob = await dataUrlToBlob(src);
      return uploadImage(blob, `pin-${pin.id}-${i + 1}.jpg`);
    }),
  );
  return { ...pin, images };
}

export const apiRepository: TasteRepository = {
  async loadAll(): Promise<RepoData> {
    return normalize(await api<RepoData>("/api/bootstrap"));
  },

  saveProfile(profile: Profile): Promise<void> {
    return api<void>("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        ...profile,
        // undefined는 JSON에서 사라지므로 명시적으로 null 전송(이미지 제거 반영)
        profileImageUrl: profile.profileImageUrl ?? null,
        // 빈 문자열/undefined는 null로 보내 username 미설정을 명시(서버가 정규화·중복검사).
        username: profile.username?.trim() || null,
      }),
    });
  },

  addFolder(folder: TasteFolder): Promise<void> {
    // sortOrder·createdAt은 서버 권위값이므로 보내지 않는다(보내도 무시됨).
    return api<void>("/api/folders", {
      method: "POST",
      body: JSON.stringify({
        id: folder.id,
        type: folder.type,
        name: folder.name,
        coverImageUrl: folder.coverImageUrl ?? null,
      }),
    });
  },

  updateFolder(_type: ContentType, id: string, patch: FolderPatch): Promise<void> {
    // supabaseRepository와 동일 시맨틱: "coverImageUrl" 키가 존재하면
    // undefined라도 null로 보내 커버를 제거한다(JSON.stringify는 undefined를 버림).
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if ("coverImageUrl" in patch) body.coverImageUrl = patch.coverImageUrl ?? null;
    if (patch.sortOrder !== undefined) body.sortOrder = patch.sortOrder;
    return api<void>(`/api/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteFolder(_type: ContentType, id: string): Promise<void> {
    // 내부 콘텐츠 캐스케이드 삭제는 서버가 처리한다.
    return api<void>(`/api/folders/${id}`, { method: "DELETE" });
  },

  addContent(content: TasteContent): Promise<void> {
    return api<void>("/api/contents", {
      method: "POST",
      body: JSON.stringify({
        id: content.id,
        type: content.type,
        folderId: content.folderId,
        youtubeVideoId: content.youtubeVideoId,
        sourceTitle: content.sourceTitle,
        sourceChannel: content.sourceChannel,
        thumbnailUrl: content.thumbnailUrl,
        title: content.title,
        subtitle: content.subtitle,
        body: content.body,
      }),
    });
  },

  updateContent(
    _type: ContentType,
    id: string,
    patch: ContentPatch,
  ): Promise<void> {
    // title/subtitle/body는 undefined = 변경 안 함 — stringify가 버려도 의미 동일.
    return api<void>(`/api/contents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteContent(_type: ContentType, id: string): Promise<void> {
    return api<void>(`/api/contents/${id}`, { method: "DELETE" });
  },

  savePinBoard(board: BoardSettings): Promise<void> {
    return api<void>("/api/pinboard", {
      method: "PUT",
      body: JSON.stringify(board),
    });
  },

  async addPin(pin: Pin): Promise<void> {
    const uploaded = await uploadInlinePinImages(pin);
    await api<void>("/api/pins", {
      method: "POST",
      body: JSON.stringify(uploaded),
    });
  },

  async updatePin(id: string, patch: Partial<Pin>): Promise<void> {
    const next =
      patch.images !== undefined
        ? await uploadInlinePinImages({ ...patch, id, images: patch.images })
        : patch;
    await api<void>(`/api/pins/${id}`, {
      method: "PATCH",
      body: JSON.stringify(next),
    });
  },

  deletePin(id: string): Promise<void> {
    return api<void>(`/api/pins/${id}`, { method: "DELETE" });
  },
};

/** 쓰기 메서드는 절대 호출되지 않는다(isOwner=false가 편집 UI를 전부 가림) — 방어적으로 거부. */
async function readOnly(): Promise<void> {
  throw new Error("Public archives are read-only.");
}

/**
 * `/u/{username}` 공개 아카이브용 읽기 전용 저장소 — #66.
 * 인증 없이(또는 남의 계정으로 로그인해도) 해당 유저의 공개 데이터만 읽는다.
 * loadAll()은 유저를 못 찾으면 ApiError(404)로 reject — TasteDataProvider의
 * error 상태로 이어져 "사용자를 찾을 수 없습니다" 화면을 띄운다.
 */
export function publicRepository(username: string): TasteRepository {
  return {
    async loadAll(): Promise<RepoData> {
      return normalize(await api<RepoData>(`/api/u/${encodeURIComponent(username)}`));
    },
    saveProfile: readOnly,
    addFolder: readOnly,
    updateFolder: readOnly,
    deleteFolder: readOnly,
    addContent: readOnly,
    updateContent: readOnly,
    deleteContent: readOnly,
    savePinBoard: readOnly,
    addPin: readOnly,
    updatePin: readOnly,
    deletePin: readOnly,
  };
}
