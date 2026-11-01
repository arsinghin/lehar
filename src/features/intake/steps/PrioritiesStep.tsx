import {
  CATEGORY_LABELS,
  MAX_PRIORITY,
  PRIORITY_LABELS,
  toPriority,
  type Category,
  type Priority,
} from '../../../core/constants/enums';
import { relevantCategories } from '../../../core/profile';
import { toggleItem } from '../../../lib/util';
import type { StepProps } from './stepProps';

/** Step 3: how much each area matters, and what must never be cut. */
export function PrioritiesStep({ draft, update }: Omit<StepProps, 'errorFor'>) {
  return (
    <>
      <p className="muted">
        Rate each area. When money is tight, Lehar suggests savings in the areas you rate lowest
        first. Tick “Protect” for anything that must never be cut.
      </p>
      <div className="priority-list">
        {relevantCategories(draft.eventType).map((category) => (
          <PriorityRow
            key={category}
            category={category}
            value={draft.priorities[category]}
            isProtected={draft.protectedCategories.includes(category)}
            onValue={(priority) => {
              update({ priorities: { ...draft.priorities, [category]: priority } });
            }}
            onProtect={(isProtected) => {
              update({
                protectedCategories: toggleItem(draft.protectedCategories, category, isProtected),
              });
            }}
          />
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.lockGuestCount}
          onChange={(event) => {
            update({ lockGuestCount: event.target.checked });
          }}
        />
        Never suggest cutting the guest list
      </label>
    </>
  );
}

interface PriorityRowProps {
  category: Category;
  value: Priority;
  isProtected: boolean;
  onValue: (value: Priority) => void;
  onProtect: (value: boolean) => void;
}

function PriorityRow({ category, value, isProtected, onValue, onProtect }: PriorityRowProps) {
  const id = `priority-${category}`;
  return (
    <div className="priority-row">
      <label htmlFor={id} className="priority-row__label">
        {CATEGORY_LABELS[category]}
      </label>
      <input
        id={id}
        className="range"
        type="range"
        min={1}
        max={MAX_PRIORITY}
        step={1}
        value={value}
        aria-valuetext={`${String(value)} of ${String(MAX_PRIORITY)}: ${PRIORITY_LABELS[value]}`}
        onChange={(event) => {
          const priority = toPriority(Number(event.target.value));
          if (priority !== null) onValue(priority);
        }}
      />
      <span className="priority-row__value" aria-hidden="true">
        {PRIORITY_LABELS[value]}
      </span>
      <label className="check">
        <input
          type="checkbox"
          aria-label={`Protect ${CATEGORY_LABELS[category]}`}
          checked={isProtected}
          onChange={(event) => {
            onProtect(event.target.checked);
          }}
        />
        Protect
      </label>
    </div>
  );
}
