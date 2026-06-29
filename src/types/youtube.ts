import type { ContentType } from "./content";

/**
 * Normalized search result returned by the (future) serverless search endpoint.
 * Step 3 will populate these from the YouTube Data API v3 response.
 */
export interface YouTubeSearchResult {
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export interface YouTubeSearchParams {
  query: string;
  /** Determines the default category filter sent to the search endpoint. */
  type: ContentType;
}
