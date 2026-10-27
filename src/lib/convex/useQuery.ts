import { useQuery as useLiveQuery, type OptionalRestArgsOrSkip } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { useEffect } from "react";
import { useOnline } from "@/lib/hooks/useOnline";
import { forgetCachedQueries, readCachedQuery, writeCachedQuery } from "@/lib/offline/queryCache";

/**
 * Queries that do not depend on which franchise is active. Every other query reads the active
 * franchise on the server, so its cached result is kept per franchise.
 */
const UNSCOPED = new Set([
  "franchise/franchises:getActive",
  "franchise/franchises:list",
  "account:me",
  "account:authInfo",
  "league/teams:list",
  "league/logos:urls",
]);

let scope = "";

/** Called by the franchise provider whenever the active franchise is known. */
export function setQueryCacheScope(franchiseId: string): void {
  scope = franchiseId;
}

/** Drops a deleted franchise's cached results, so nothing of it reads back offline. */
export function forgetQueryCacheScope(franchiseId: string): void {
  if (scope === franchiseId) scope = "";
  forgetCachedQueries(`${franchiseId}|`);
}

/**
 * Convex's `useQuery`, plus the offline read cache: every live result is kept, and with no
 * connection the screen gets the last one instead of loading forever (FEATURES.md 5.13). Online,
 * it behaves exactly like Convex's, so stale data never stands in for a slow query.
 */
export function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query["_returnType"] | undefined {
  const live = useLiveQuery(query, ...args);
  const online = useOnline();
  const name = getFunctionName(query);
  const key =
    args[0] === "skip"
      ? null
      : `${UNSCOPED.has(name) ? "-" : scope}|${name}|${JSON.stringify(args[0] ?? {})}`;

  useEffect(() => {
    if (key !== null && live !== undefined) writeCachedQuery(key, live);
  }, [key, live]);

  if (live !== undefined || online || key === null) return live;
  return readCachedQuery(key) as Query["_returnType"] | undefined;
}
