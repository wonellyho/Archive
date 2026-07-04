import { supabase } from "./supabaseClient";

/**
 * FastAPI 백엔드 호출 공용 헬퍼.
 * VITE_API_URL이 없으면 백엔드 미사용(기존 Supabase/localStorage 경로 유지).
 */
// 끝 슬래시는 제거해 "//api/..." 같은 잘못된 경로를 방지한다.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/+$/,
  "",
);

export const isApiConfigured = Boolean(API_URL);

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 로그인 상태면 Supabase 세션의 access token을 Bearer로 첨부한다. */
export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API 요청 실패 (HTTP ${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
