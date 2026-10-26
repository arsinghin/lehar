/**
 * Form fields with a label, a hint and an error, wired with aria-describedby and aria-invalid,
 * so screen readers announce the hint and the error with the input.
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

import { cx } from '../lib/util';

interface FieldMeta {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  /** Visually hide the label (it is still read by screen readers). */
  hideLabel?: boolean;
}

function useFieldIds(id: string | undefined, hint: ReactNode, error: string | undefined) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { fieldId, hintId, errorId, describedBy };
}

function Meta({
  hint,
  hintId,
  error,
  errorId,
}: {
  hint: ReactNode;
  hintId: string | undefined;
  error: string | undefined;
  errorId: string | undefined;
}) {
  return (
    <>
      {hint ? (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field__error">
          {error}
        </span>
      ) : null}
    </>
  );
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  id,
  className,
  ...input
}: FieldMeta & InputHTMLAttributes<HTMLInputElement>) {
  const ids = useFieldIds(id, hint, error);
  return (
    <div className={cx('field', className)}>
      <label htmlFor={ids.fieldId} className={cx(hideLabel && 'visually-hidden')}>
        {label}
      </label>
      <input
        id={ids.fieldId}
        className="input"
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      <Meta hint={hint} hintId={ids.hintId} error={error} errorId={ids.errorId} />
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  hideLabel,
  id,
  className,
  ...input
}: FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ids = useFieldIds(id, hint, error);
  return (
    <div className={cx('field', className)}>
      <label htmlFor={ids.fieldId} className={cx(hideLabel && 'visually-hidden')}>
        {label}
      </label>
      <textarea
        id={ids.fieldId}
        className="textarea"
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      <Meta hint={hint} hintId={ids.hintId} error={error} errorId={ids.errorId} />
    </div>
  );
}
