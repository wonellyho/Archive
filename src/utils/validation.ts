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
      message: `Please enter at least ${MIN_QUERY_LENGTH} characters.`,
    };
  }
  return { valid: true, query };
}
