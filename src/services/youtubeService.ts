import type { ContentType } from "../types/content";
import type { YouTubeSearchResult } from "../types/youtube";

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

interface YouTubeApiThumbnail {
  url: string;
}

interface YouTubeApiItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      default?: YouTubeApiThumbnail;
      medium?: YouTubeApiThumbnail;
      high?: YouTubeApiThumbnail;
    };
  };
}

interface YouTubeApiResponse {
  items?: YouTubeApiItem[];
}

export class YouTubeServiceError extends Error {}

/**
 * Calls the YouTube Data API v3 search endpoint directly from the client using
 * VITE_YOUTUBE_API_KEY. Music searches add the music category filter; the user
 * can still override the final content type when registering.
 */
export async function searchYouTube(
  query: string,
  type: ContentType,
): Promise<YouTubeSearchResult[]> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new YouTubeServiceError(
      "YouTube API 키가 없습니다. 프로젝트 루트에 .env를 만들고 VITE_YOUTUBE_API_KEY를 입력하세요.",
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "12",
    q: query,
    key: apiKey,
  });
  if (type === "music") {
    params.set("videoCategoryId", "10");
  }

  let response: Response;
  try {
    response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`);
  } catch {
    throw new YouTubeServiceError(
      "네트워크 오류로 검색에 실패했습니다. 연결을 확인해 주세요.",
    );
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new YouTubeServiceError(
        "API 할당량을 초과했거나 키가 유효하지 않습니다. 키 설정과 사용량을 확인하세요.",
      );
    }
    throw new YouTubeServiceError(`검색에 실패했습니다 (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as YouTubeApiResponse;
  const items = data.items ?? [];

  return items
    .filter((item) => item.id?.videoId)
    .map((item) => {
      const videoId = item.id?.videoId ?? "";
      const snippet = item.snippet;
      const thumbnails = snippet?.thumbnails;
      return {
        youtubeVideoId: videoId,
        title: snippet?.title ?? "(제목 없음)",
        channelTitle: snippet?.channelTitle ?? "",
        thumbnailUrl:
          thumbnails?.medium?.url ??
          thumbnails?.high?.url ??
          thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      } satisfies YouTubeSearchResult;
    });
}
