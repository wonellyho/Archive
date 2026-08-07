import { api } from "./apiClient";

/** 한 기간(월)의 콘텐츠 집계. 백엔드 TimelineBucket과 1:1. */
export interface TimelineBucket {
  /** 기간(YYYY-MM). */
  period: string;
  total: number;
  music: number;
  video: number;
}

export interface TimelineResponse {
  username: string;
  buckets: TimelineBucket[];
}

/**
 * 사용자 취향 타임라인을 가져온다 — GET /api/timeline/{username}.
 * 공개 엔드포인트(인증 불필요). 없는 사용자면 ApiError(404).
 */
export function getTimeline(username: string): Promise<TimelineResponse> {
  return api<TimelineResponse>(`/api/timeline/${encodeURIComponent(username)}`);
}
