import { CheckboxGroup } from '../../../components/ChoiceGroup';
import { TextAreaField, TextField } from '../../../components/Field';
import {
  ACCESS_NEED_LABELS,
  ACCESS_NEEDS,
  AGE_GROUP_LABELS,
  AGE_GROUPS,
  DIET_LABELS,
  DIETS,
} from '../../../core/constants/enums';
import { LIMITS } from '../../../core/constants/limits';
import { FIELD_IDS } from '../intakeDraft';
import type { StepProps } from './stepProps';

/** Step 4: who is coming, what they eat, access needs, culture and must-haves. */
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
        hint={`One per line, up to ${String(LIMITS.maxMustHaves)}. For example: “Live dhol”, “Pure-veg menu”.`}
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
