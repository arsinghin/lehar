/** Radio and checkbox groups rendered as a fieldset with a legend, so the question is announced with each option. */
import type { ReactNode } from 'react';

import { toggleItem } from '../lib/util';
import { FieldMessages, useDescribedBy } from './Field';

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

interface GroupShellProps {
  legend: ReactNode;
  hint: string | undefined;
  error: string | undefined;
  id: string | undefined;
  children: ReactNode;
}

function GroupShell({ legend, hint, error, id, children }: GroupShellProps) {
  const ids = useDescribedBy(id, hint, error);
  return (
    <fieldset id={ids.id} aria-describedby={ids.describedBy} tabIndex={-1}>
      <legend>{legend}</legend>
      <FieldMessages ids={ids} hint={hint} error={error} as="p" />
      <div className="choices">{children}</div>
    </fieldset>
  );
}

interface ChoiceProps {
  type: 'radio' | 'checkbox';
  name: string;
  option: ChoiceOption<string>;
  checked: boolean;
  onChange: () => void;
}

function Choice({ type, name, option, checked, onChange }: ChoiceProps) {
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

export interface RadioGroupProps<T extends string> extends GroupProps<T> {
  value: T;
  onChange: (value: T) => void;
}

/** One answer from a short list. */
export function RadioGroup<T extends string>({ value, onChange, ...group }: RadioGroupProps<T>) {
  return (
    <GroupShell legend={group.legend} hint={group.hint} error={group.error} id={group.id}>
      {group.options.map((option) => (
        <Choice
          key={option.value}
          type="radio"
          name={group.name}
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

export interface CheckboxGroupProps<T extends string> extends GroupProps<T> {
  value: readonly T[];
  onChange: (value: T[]) => void;
}

/** Any number of answers from a short list. */
export function CheckboxGroup<T extends string>({
  value,
  onChange,
  ...group
}: CheckboxGroupProps<T>) {
  return (
    <GroupShell legend={group.legend} hint={group.hint} error={group.error} id={group.id}>
      {group.options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <Choice
            key={option.value}
            type="checkbox"
            name={group.name}
            option={option}
            checked={checked}
            onChange={() => {
              onChange(toggleItem(value, option.value, !checked));
            }}
          />
        );
      })}
    </GroupShell>
  );
}
