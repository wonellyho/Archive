export const MIN_QUERY_LENGTH = 2;

export interface QueryCheck {
  valid: boolean;
  query: string;
  message?: string;
}

/** Trim and validate a search query before hitting the API. */
export function checkQuery(raw: string): QueryCheck {
  const query = raw.trim();
  if (query.length < MIN_QUERY_LENGTH) {
    return {
      valid: false,
      query,
      message: `검색어는 ${MIN_QUERY_LENGTH}글자 이상 입력해 주세요.`,
    };
  }
  return { valid: true, query };
}
