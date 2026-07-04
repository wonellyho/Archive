import type { RepoData, TasteRepository } from "./repository";
import { supabaseRepository } from "./supabaseRepository";
import { api } from "./apiClient";

/**
 * FastAPI 백엔드 경유 저장소 — P2 하이브리드 단계.
 * 읽기(loadAll)만 백엔드 API(/api/bootstrap)로 가져오고,
 * 쓰기는 기존 supabaseRepository에 위임한다(쓰기 전환은 P4에서).
 *
 * 롤백: .env에서 VITE_API_URL을 지우면 즉시 기존 경로로 복귀한다.
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
  };
}

export const apiRepository: TasteRepository = {
  async loadAll(): Promise<RepoData> {
    return normalize(await api<RepoData>("/api/bootstrap"));
  },
  // 쓰기는 P4(#11)까지 기존 경로 유지 — 하이브리드.
  saveProfile: supabaseRepository.saveProfile,
  addFolder: supabaseRepository.addFolder,
  updateFolder: supabaseRepository.updateFolder,
  deleteFolder: supabaseRepository.deleteFolder,
  addContent: supabaseRepository.addContent,
  updateContent: supabaseRepository.updateContent,
  deleteContent: supabaseRepository.deleteContent,
};
