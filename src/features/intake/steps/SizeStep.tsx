import { RadioGroup } from '../../../components/ChoiceGroup';
import { TextField } from '../../../components/Field';
import { TIER_DESCRIPTIONS, TIER_LABELS, TIERS } from '../../../core/constants/enums';
import { budgetPreview, FIELD_IDS } from '../intakeDraft';
import type { StepProps } from './stepProps';

/** Step 2: guests, budget (in any Indian format) and the style of event. */
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
        className="field--narrow"
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
        className="field--narrow"
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
