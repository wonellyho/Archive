import type { ContentType } from "../types/content";
import type { YouTubeSearchResult } from "../types/youtube";
import { api, ApiError, isApiConfigured } from "./apiClient";

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
 * Searches YouTube. When the FastAPI backend is configured (VITE_API_URL) the
 * request goes through the `/api/youtube/search` proxy so the API key stays on
 * the server (🔒 login required). Otherwise it falls back to the direct client
 * call below. Music searches add the music category filter; the user can still
 * override the final content type when registering.
 */
export async function searchYouTube(
  query: string,
  type: ContentType,
): Promise<YouTubeSearchResult[]> {
  if (isApiConfigured) return searchViaBackend(query, type);
  return searchDirect(query, type);
}

/** 백엔드 프록시 경유 — 응답은 이미 YouTubeSearchResult 형태(camelCase)로 정규화돼 있다. */
async function searchViaBackend(
  query: string,
  type: ContentType,
): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({ q: query, type });
  try {
    return await api<YouTubeSearchResult[]>(
      `/api/youtube/search?${params.toString()}`,
    );
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        throw new YouTubeServiceError(
          "Please log in to search.",
        );
      }
      if (err.status === 429) {
        throw new YouTubeServiceError(
          "Too many search requests or quota exceeded. Please try again shortly.",
        );
      }
      if (err.status === 503) {
        throw new YouTubeServiceError(
          "The server has no YouTube API key configured. Please contact an admin.",
        );
      }
      throw new YouTubeServiceError(`Search failed (HTTP ${err.status}).`);
    }
    throw new YouTubeServiceError(
      "Search failed due to a network error. Please check your connection.",
    );
  }
}

/** 백엔드 미설정 시 폴백 — VITE_YOUTUBE_API_KEY로 브라우저에서 직접 호출. */
async function searchDirect(
  query: string,
  type: ContentType,
): Promise<YouTubeSearchResult[]> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new YouTubeServiceError(
      "No YouTube API key found. Create a .env file in the project root and set VITE_YOUTUBE_API_KEY.",
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
      "Search failed due to a network error. Please check your connection.",
    );
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new YouTubeServiceError(
        "API quota exceeded or the key is invalid. Please check your key setup and usage.",
      );
    }
    throw new YouTubeServiceError(`Search failed (HTTP ${response.status}).`);
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
        title: snippet?.title ?? "(No title)",
        channelTitle: snippet?.channelTitle ?? "",
        thumbnailUrl:
          thumbnails?.medium?.url ??
          thumbnails?.high?.url ??
          thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      } satisfies YouTubeSearchResult;
    });
}
