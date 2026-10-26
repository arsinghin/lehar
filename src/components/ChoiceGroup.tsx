/** Radio and checkbox groups rendered as a fieldset with a legend, so the question is announced with each option. */
import { useId, type ReactNode } from 'react';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface GroupProps<T extends string> {
  legend: ReactNode;
  hint?: string;
  error?: string | undefined;
  name: string;
  options: readonly ChoiceOption<T>[];
  id?: string;
}

function GroupShell({
  legend,
  hint,
  error,
  id,
  children,
}: {
  legend: ReactNode;
  hint: string | undefined;
  error: string | undefined;
  id: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      id={id}
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      tabIndex={-1}
    >
      <legend>{legend}</legend>
      {hint ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field__error">
          {error}
        </p>
      ) : null}
      <div className="choices">{children}</div>
    </fieldset>
  );
}

function Choice({
  type,
  name,
  option,
  checked,
  onChange,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  option: ChoiceOption<string>;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="choice">
      <input type={type} name={name} value={option.value} checked={checked} onChange={onChange} />
      <span className="choice__text">
        <span>{option.label}</span>
        {option.description ? <span className="choice__desc">{option.description}</span> : null}
      </span>
    </label>
  );
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  id,
  ...props
}: GroupProps<T> & { value: T; onChange: (value: T) => void }) {
  const generated = useId();
  return (
    <GroupShell legend={props.legend} hint={props.hint} error={props.error} id={id ?? generated}>
      {props.options.map((option) => (
        <Choice
          key={option.value}
          type="radio"
          name={props.name}
          option={option}
          checked={value === option.value}
          onChange={() => {
            onChange(option.value);
          }}
        />
      ))}
    </GroupShell>
  );
}

export function CheckboxGroup<T extends string>({
  value,
  onChange,
  id,
  ...props
}: GroupProps<T> & { value: readonly T[]; onChange: (value: T[]) => void }) {
  const generated = useId();
  return (
    <GroupShell legend={props.legend} hint={props.hint} error={props.error} id={id ?? generated}>
      {props.options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <Choice
            key={option.value}
            type="checkbox"
            name={props.name}
            option={option}
            checked={checked}
            onChange={() => {
              onChange(
                checked ? value.filter((item) => item !== option.value) : [...value, option.value],
              );
            }}
          />
        );
      })}
    </GroupShell>
  );
}
