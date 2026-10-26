/** The five intake steps. Each is a small presentational component over the shared draft. */
import { Alert, BudgetStatusBadge } from '../../components/Badge';
import { CheckboxGroup, RadioGroup } from '../../components/ChoiceGroup';
import { TextAreaField, TextField } from '../../components/Field';
import { estimateBudget } from '../../core/budget';
import {
  ACCESS_NEED_LABELS,
  ACCESS_NEEDS,
  AGE_GROUP_LABELS,
  AGE_GROUPS,
  CATEGORY_LABELS,
  DIET_LABELS,
  DIETS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  PRIORITY_LABELS,
  TIER_DESCRIPTIONS,
  TIER_LABELS,
  TIERS,
  type Category,
  type EventType,
  type Priority,
} from '../../core/constants/enums';
import { LIMITS } from '../../core/constants/limits';
import { addDays, formatDateLong } from '../../core/dates';
import { formatInr } from '../../core/money';
import { relevantCategories } from '../../core/profile';
import type { EventProfile } from '../../core/schemas';
import { budgetPreview, FIELD_IDS, type IntakeDraft } from './intakeDraft';

export interface StepProps {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  errorFor: (fieldId: string) => string | undefined;
}

const EVENT_DESCRIPTIONS = {
  wedding: 'Functions, families, many vendors',
  birthday: 'Kids’ parties to milestone birthdays',
  community: 'Society, temple, school or club events',
} as const;

export function OccasionStep({
  draft,
  update,
  errorFor,
  today,
  onEventType,
}: StepProps & { today: string; onEventType: (eventType: EventType) => void }) {
  return (
    <>
      <RadioGroup
        id={FIELD_IDS.eventType}
        legend="What are you planning?"
        name="eventType"
        value={draft.eventType}
        options={EVENT_TYPES.map((type) => ({
          value: type,
          label: EVENT_TYPE_LABELS[type],
          description: EVENT_DESCRIPTIONS[type],
        }))}
        onChange={(eventType) => {
          onEventType(eventType);
        }}
      />
      <TextField
        id={FIELD_IDS.eventDate}
        label="Event date"
        type="date"
        min={today}
        max={addDays(today, LIMITS.maxHorizonDays)}
        required
        value={draft.eventDate}
        error={errorFor(FIELD_IDS.eventDate)}
        className="input--narrow"
        onChange={(event) => {
          update({ eventDate: event.target.value });
        }}
      />
      <TextField
        id={FIELD_IDS.title}
        label="Name for this plan (optional)"
        hint="Only stored in your browser. It is never sent to the AI."
        maxLength={LIMITS.maxTitle}
        autoComplete="off"
        value={draft.title}
        error={errorFor(FIELD_IDS.title)}
        onChange={(event) => {
          update({ title: event.target.value });
        }}
      />
      <TextField
        id={FIELD_IDS.city}
        label="City or town (optional)"
        hint="Used for vendor searches on Google Maps and for season-aware ideas."
        maxLength={LIMITS.maxCity}
        autoComplete="address-level2"
        value={draft.city}
        error={errorFor(FIELD_IDS.city)}
        onChange={(event) => {
          update({ city: event.target.value });
        }}
      />
    </>
  );
}

export function SizeStep({ draft, update, errorFor }: StepProps) {
  return (
    <>
      <TextField
        id={FIELD_IDS.guests}
        label="How many guests do you expect?"
        hint="A rough number is fine. You can change it any time."
        inputMode="numeric"
        autoComplete="off"
        required
        className="input--narrow"
        value={draft.guests}
        error={errorFor(FIELD_IDS.guests)}
        onChange={(event) => {
          update({ guests: event.target.value });
        }}
      />
      <TextField
        id={FIELD_IDS.budget}
        label="Total budget"
        hint={
          budgetPreview(draft.budget) ??
          'Type it the way you say it: “8 lakh”, “75k” or “₹1,50,000”.'
        }
        inputMode="decimal"
        autoComplete="off"
        required
        className="input--narrow"
        value={draft.budget}
        error={errorFor(FIELD_IDS.budget)}
        onChange={(event) => {
          update({ budget: event.target.value });
        }}
      />
      <RadioGroup
        id={FIELD_IDS.tier}
        legend="What kind of experience are you after?"
        name="tier"
        value={draft.tier}
        options={TIERS.map((tier) => ({
          value: tier,
          label: TIER_LABELS[tier],
          description: TIER_DESCRIPTIONS[tier],
        }))}
        onChange={(tier) => {
          update({ tier });
        }}
      />
    </>
  );
}

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
                protectedCategories: isProtected
                  ? [...draft.protectedCategories, category]
                  : draft.protectedCategories.filter((item) => item !== category),
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

export function PeopleStep({ draft, update, errorFor }: StepProps) {
  return (
    <>
      <CheckboxGroup
        legend="Who is coming?"
        name="ageGroups"
        value={draft.ageGroups}
        options={AGE_GROUPS.map((group) => ({
          value: group,
          label: AGE_GROUP_LABELS[group],
        }))}
        onChange={(ageGroups) => {
          update({ ageGroups });
        }}
      />
      <CheckboxGroup
        legend="Food preferences to cater for"
        name="diets"
        value={draft.diets}
        options={DIETS.map((diet) => ({ value: diet, label: DIET_LABELS[diet] }))}
        onChange={(diets) => {
          update({ diets });
        }}
      />
      <CheckboxGroup
        legend="Accessibility needs"
        hint="Lehar adds these to venue and vendor checklists."
        name="accessNeeds"
        value={draft.accessNeeds}
        options={ACCESS_NEEDS.map((need) => ({
          value: need,
          label: ACCESS_NEED_LABELS[need],
        }))}
        onChange={(accessNeeds) => {
          update({ accessNeeds });
        }}
      />
      <TextField
        id={FIELD_IDS.culture}
        label="Traditions or culture to honour (optional)"
        hint="For example: “Marathi Hindu”, “Punjabi Sikh”, “Kerala Christian”."
        maxLength={LIMITS.maxCulture}
        value={draft.culture}
        error={errorFor(FIELD_IDS.culture)}
        onChange={(event) => {
          update({ culture: event.target.value });
        }}
      />
      <TextAreaField
        id={FIELD_IDS.mustHaves}
        label="Absolute must-haves (optional)"
        hint={`One per line, up to ${LIMITS.maxMustHaves}. For example: “Live dhol”, “Pure-veg menu”.`}
        rows={3}
        value={draft.mustHaves}
        error={errorFor(FIELD_IDS.mustHaves)}
        onChange={(event) => {
          update({ mustHaves: event.target.value });
        }}
      />
    </>
  );
}

export function ReviewStep({ profile }: { profile: EventProfile | null }) {
  const preview = profile ? estimateBudget(profile) : null;
  return profile && preview ? (
    <>
      <dl className="summary-list">
        <div>
          <dt>Occasion</dt>
          <dd>{EVENT_TYPE_LABELS[profile.eventType]}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDateLong(profile.eventDate)}</dd>
        </div>
        <div>
          <dt>Guests</dt>
          <dd>{profile.guests.toLocaleString('en-IN')}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{formatInr(profile.budget)}</dd>
        </div>
        <div>
          <dt>Style</dt>
          <dd>{TIER_LABELS[profile.tier]}</dd>
        </div>
        <div>
          <dt>Protected</dt>
          <dd>
            {profile.protectedCategories.map((c) => CATEGORY_LABELS[c]).join(', ') || 'Nothing yet'}
          </dd>
        </div>
      </dl>
      <Alert tone={preview.status === 'over' ? 'warn' : 'ok'} title="First estimate">
        <p>
          Based on Lehar’s planning assumptions, this kind of event costs about{' '}
          <strong>{formatInr(preview.total)}</strong> including a {preview.contingencyPct}
          % buffer. <BudgetStatusBadge status={preview.status} />
        </p>
        <p className="small">
          These are estimates, not quotes. You can change every assumption in the plan.
        </p>
      </Alert>
    </>
  ) : (
    <Alert tone="danger" title="Something is missing">
      <p>Please go back and check the earlier steps.</p>
    </Alert>
  );
}

function PriorityRow({
  category,
  value,
  isProtected,
  onValue,
  onProtect,
}: {
  category: Category;
  value: Priority;
  isProtected: boolean;
  onValue: (value: Priority) => void;
  onProtect: (value: boolean) => void;
}) {
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
        max={5}
        step={1}
        value={value}
        aria-valuetext={`${value} of 5: ${PRIORITY_LABELS[value]}`}
        onChange={(event) => {
          onValue(Number(event.target.value) as Priority);
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
