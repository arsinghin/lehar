/**
 * A visible, announced status area for "ripple" messages ("Catering +₹55,000, total now …").
 * There is one region for the whole workspace, so screen readers hear every update exactly once.
 */
import { createContext, use, useState, type ReactNode } from 'react';

import { Alert, type AlertTone } from './Alert';
import { Button } from './Button';

export interface NoticeMessage {
  tone: AlertTone;
  text: string;
}

const NoticeContext = createContext<((notice: NoticeMessage | null) => void) | null>(null);

/** Owns the single announced status region and lets any screen post to it with `useNotify`. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  return (
    <NoticeContext value={setNotice}>
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

/** Shows a message in the status region, or clears it with null. */
export function useNotify(): (notice: NoticeMessage | null) => void {
  const notify = use(NoticeContext);
  if (!notify) throw new Error('useNotify must be used inside <NoticeProvider>');
  return notify;
}
