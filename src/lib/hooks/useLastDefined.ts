import { useState } from "react";

/**
 * The value, or the last one that was not undefined while the next is loading: a result list
 * keeps what it shows instead of emptying and refilling (and jumping) on every new query.
 */
export function useLastDefined<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState(value);
  if (value !== undefined && value !== last) setLast(value);
  return value ?? last;
}
