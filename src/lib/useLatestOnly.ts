import { useMemo, useRef } from 'react';

export interface LatestOnly {
  /** Starts a request and returns its token. */
  begin(): number;
  /** False once a newer request has started or `invalidate` was called. */
  isCurrent(token: number): boolean;
  /** Marks every request in flight as stale, e.g. when the input it was based on changes. */
  invalidate(): void;
}

/** Lets an async handler drop its result when a newer request or an edit has superseded it. */
export function useLatestOnly(): LatestOnly {
  const counter = useRef(0);
  return useMemo(
    () => ({
      begin: () => ++counter.current,
      isCurrent: (token) => token === counter.current,
      invalidate: () => {
        counter.current += 1;
      },
    }),
    [],
  );
}
