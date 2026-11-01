/**
 * Form fields with a label, a hint and an error, wired with aria-describedby and aria-invalid,
 * so screen readers announce the hint and the error with the input.
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cx } from '../lib/util';

export interface FieldMeta {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  /** Visually hide the label (it is still read by screen readers). */
  hideLabel?: boolean;
}

export interface DescribedBy {
  id: string;
  hintId: string | undefined;
  errorId: string | undefined;
  describedBy: string | undefined;
}

/** Ids for a control and its hint and error, and the matching aria-describedby value. */
export function useDescribedBy(id: string | undefined, hint: unknown, error: unknown): DescribedBy {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id: controlId, hintId, errorId, describedBy };
}

export interface FieldMessagesProps {
  ids: DescribedBy;
  hint: ReactNode;
  error: string | undefined;
  /** Paragraphs suit fieldsets; spans suit the grid of a single field. */
  as?: 'span' | 'p';
}

/** The hint and error lines under a control (or a group of controls). */
export function FieldMessages({ ids, hint, error, as: Tag = 'span' }: FieldMessagesProps) {
  return (
    <>
      {hint ? (
        <Tag id={ids.hintId} className="field__hint">
          {hint}
        </Tag>
      ) : null}
      {error ? (
        <Tag id={ids.errorId} className="field__error">
          {error}
        </Tag>
      ) : null}
    </>
  );
}

interface FieldShellProps extends FieldMeta {
  ids: DescribedBy;
  className: string | undefined;
  children: ReactNode;
}

function FieldShell({ ids, label, hint, error, hideLabel, className, children }: FieldShellProps) {
  return (
    <div className={cx('field', className)}>
      <label htmlFor={ids.id} className={cx(hideLabel && 'visually-hidden')}>
        {label}
      </label>
      {children}
      <FieldMessages ids={ids} hint={hint} error={error} />
    </div>
  );
}

/** Props every control receives from its shell. */
function controlProps(ids: DescribedBy, error: string | undefined) {
  return {
    id: ids.id,
    'aria-describedby': ids.describedBy,
    'aria-invalid': error ? true : undefined,
  };
}

export type TextFieldProps = FieldMeta & InputHTMLAttributes<HTMLInputElement>;

/** A labelled text input with an optional hint and error. */
export function TextField({
  label,
  hint,
  error,
  hideLabel,
  id,
  className,
  ...input
}: TextFieldProps) {
  const ids = useDescribedBy(id, hint, error);
  return (
    <FieldShell {...{ ids, label, hint, error, hideLabel, className }}>
      <input className="input" {...controlProps(ids, error)} {...input} />
    </FieldShell>
  );
}

export type TextAreaFieldProps = FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>;

/** A labelled multi-line input with an optional hint and error. */
export function TextAreaField({
  label,
  hint,
  error,
  hideLabel,
  id,
  className,
  ...input
}: TextAreaFieldProps) {
  const ids = useDescribedBy(id, hint, error);
  return (
    <FieldShell {...{ ids, label, hint, error, hideLabel, className }}>
      <textarea className="textarea" {...controlProps(ids, error)} {...input} />
    </FieldShell>
  );
}

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SelectFieldProps<T extends string | number>
  extends FieldMeta, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
  /** Smaller select for use inside tables and rows. */
  compact?: boolean;
}

/** A labelled select that reports the chosen option's typed value, so callers never cast. */
export function SelectField<T extends string | number>({
  label,
  hint,
  error,
  hideLabel,
  id,
  className,
  value,
  options,
  onValueChange,
  compact,
  ...select
}: SelectFieldProps<T>) {
  const ids = useDescribedBy(id, hint, error);
  return (
    <FieldShell {...{ ids, label, hint, error, hideLabel, className }}>
      <select
        className={cx('select', compact && 'select--compact')}
        {...controlProps(ids, error)}
        {...select}
        value={String(value)}
        onChange={(event) => {
          const chosen = options.find((option) => String(option.value) === event.target.value);
          if (chosen) onValueChange(chosen.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
