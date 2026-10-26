/**
 * A visible, announced status area for "ripple" messages ("Catering +₹55,000, total now …").
 * There is one region for the whole workspace, so screen readers hear every update exactly once.
 */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { Alert, type Tone } from './Badge';
import { Button } from './Button';

export interface NoticeMessage {
  tone: Exclude<Tone, 'neutral'>;
  text: string;
}

const NoticeContext = createContext<((notice: NoticeMessage | null) => void) | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const notify = useCallback((next: NoticeMessage | null) => {
    setNotice(next);
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <NoticeContext value={value}>
      <div className="notice-region" role="status" aria-live="polite">
        {notice ? (
          <Alert tone={notice.tone}>
            <div className="row row--between">
              <p>{notice.text}</p>
              <Button
                variant="ghost"
                size="s"
                icon="close"
                aria-label="Dismiss message"
                onClick={() => {
                  setNotice(null);
                }}
              />
            </div>
          </Alert>
        ) : null}
      </div>
      {children}
    </NoticeContext>
  );
}

export function useNotify(): (notice: NoticeMessage | null) => void {
  const notify = use(NoticeContext);
  if (!notify) throw new Error('useNotify must be used inside <NoticeProvider>');
  return notify;
}
