import type { ButtonHTMLAttributes } from 'react';

/** A compact suggestion button, e.g. an example change or a one-click refinement. */
export function Chip(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'>) {
  return <button type="button" className="chip" {...props} />;
}
