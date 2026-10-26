/** Error summary that receives focus on a failed submit and links to each invalid field. */
import { useEffect, useRef } from 'react';

export interface FieldError {
  fieldId: string;
  message: string;
}

export function ErrorSummary({
  errors,
  focusKey,
}: {
  errors: readonly FieldError[];
  focusKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length > 0) ref.current?.focus();
    // Re-focus on every failed attempt, not only when the error list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  if (errors.length === 0) return null;
  return (
    <div
      ref={ref}
      className="error-summary"
      role="alert"
      tabIndex={-1}
      aria-labelledby="error-summary-title"
    >
      <h3 id="error-summary-title">
        Please fix {errors.length === 1 ? 'this' : `these ${errors.length} things`}
      </h3>
      <ul>
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a
              href={`#${error.fieldId}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.fieldId)?.focus();
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
