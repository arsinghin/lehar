/**
 * Modal dialog on the native <dialog> element. It gets focus trapping, Escape to close, inert
 * background and focus restoration from the browser, with no third-party code.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from './Button';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <>
          <div className="dialog__header">
            <h2 id={titleId}>{title}</h2>
            <Button
              variant="ghost"
              size="s"
              icon="close"
              aria-label="Close dialog"
              onClick={onClose}
            />
          </div>
          <div className="dialog__body">{children}</div>
          {footer ? <div className="dialog__footer">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}
