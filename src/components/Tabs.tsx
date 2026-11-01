/** WAI-ARIA tabs pattern with roving tabindex and Arrow, Home and End keys. */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number | undefined;
  countLabel?: string | undefined;
}

interface TabsProps<T extends string> {
  label: string;
  items: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  idPrefix: string;
}

/** DOM id of a tab button, shared by the tab and its panel. */
export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
/** DOM id of a tab panel. */
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** A tab list; Arrow, Home and End keys move between tabs. */
export function Tabs<T extends string>({ label, items, active, onChange, idPrefix }: TabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const focusAt = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    onChange(item.id);
    refs.current.get(item.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusAt(target);
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) refs.current.set(item.id, node);
              else refs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, item.id)}
            className="tab"
            aria-label={
              item.count
                ? `${item.label}, ${String(item.count)} ${item.countLabel ?? ''}`.trim()
                : undefined
            }
            aria-selected={selected}
            aria-controls={panelId(idPrefix, item.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(item.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            {item.label}
            {item.count ? (
              <span className="badge badge--danger tab__count" aria-hidden="true">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** The panel for the active tab, labelled by its tab. */
export function TabPanel({
  idPrefix,
  id,
  children,
}: {
  idPrefix: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)}>
      {children}
    </div>
  );
}
