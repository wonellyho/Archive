import { useCallback, useRef, useState } from "react";
import type { ContentType } from "../types/content";
import type { YouTubeSearchResult } from "../types/youtube";
import { searchYouTube, YouTubeServiceError } from "../services/youtubeService";
import { checkQuery } from "../utils/validation";

export type SearchStatus = "idle" | "loading" | "success" | "error";

export interface UseYouTubeSearch {
  status: SearchStatus;
  results: YouTubeSearchResult[];
  error: string | null;
  /** Runs once per call — only wire it to a submit/Enter, never to onChange. */
  search: (query: string, type: ContentType) => void;
  reset: () => void;
}

export function useYouTubeSearch(): UseYouTubeSearch {
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const search = useCallback((query: string, type: ContentType) => {
    const check = checkQuery(query);
    if (!check.valid) {
      setStatus("error");
      setError(check.message ?? "Please check your search query.");
      setResults([]);
      return;
    }

    // Guard against overlapping requests: only the latest one may resolve.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("loading");
    setError(null);

    searchYouTube(check.query, type)
      .then((items) => {
        if (requestId !== requestIdRef.current) return;
        setResults(items);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setStatus("error");
        setError(
          err instanceof YouTubeServiceError
            ? err.message
            : "An unknown error occurred while searching.",
        );
      });
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setStatus("idle");
    setResults([]);
    setError(null);
  }, []);

  return { status, results, error, search, reset };
}
