/** Error summary that receives focus on a failed submit and links to each invalid field. */
import { useEffect, useId, useRef } from 'react';

import type { FieldError } from '../core/validation';
import { plural } from '../lib/util';

export interface ErrorSummaryProps {
  errors: readonly FieldError[];
  /** Changes on every submit attempt, so focus returns here even when the errors are the same. */
  focusKey: number;
}

/** Lists every invalid field with a link to it, and takes focus after each failed submit. */
export function ErrorSummary({ errors, focusKey }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const count = errors.length;

  useEffect(() => {
    if (count > 0) ref.current?.focus();
  }, [focusKey, count]);

  if (count === 0) return null;
  return (
    <div ref={ref} className="error-summary" role="alert" tabIndex={-1} aria-labelledby={titleId}>
      <h3 id={titleId}>Please fix {count === 1 ? 'this' : `these ${plural(count, 'thing')}`}</h3>
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
