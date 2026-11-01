import { RadioGroup } from '../../../components/ChoiceGroup';
import { TextField } from '../../../components/Field';
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from '../../../core/constants/enums';
import { LIMITS } from '../../../core/constants/limits';
import { addDays, type IsoDate } from '../../../core/dates';
import { FIELD_IDS } from '../intakeDraft';
import type { StepProps } from './stepProps';

const EVENT_DESCRIPTIONS: Record<EventType, string> = {
  wedding: 'Functions, families, many vendors',
  birthday: 'Kids’ parties to milestone birthdays',
  community: 'Society, temple, school or club events',
};

export interface OccasionStepProps extends StepProps {
  today: IsoDate;
  onEventType: (eventType: EventType) => void;
}

/** Step 1: what kind of event, when, and where. */
export function OccasionStep({ draft, update, errorFor, today, onEventType }: OccasionStepProps) {
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
        className="field--narrow"
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
