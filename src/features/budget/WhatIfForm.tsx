import { useState } from 'react';

import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { whatIfPatch } from '../../core/plan';
import { checkBudget, checkGuests } from '../../core/validation';
import { useOpenPlan } from '../../state/PlanContext';
import { useRipplePatch } from './useRipplePatch';

interface WhatIfErrors {
  guests?: string;
  budget?: string;
}

/** Try a different headcount or budget. It is a normal, undoable edit, announced with its ripple. */
export function WhatIfForm() {
  const { plan } = useOpenPlan();
  const notify = useNotify();
  const patchWithRipple = useRipplePatch();
  const [guests, setGuests] = useState(String(plan.profile.guests));
  const [budgetText, setBudgetText] = useState(String(plan.profile.budget));
  const [errors, setErrors] = useState<WhatIfErrors>({});

  const submit = () => {
    const nextGuests = checkGuests(guests);
    const nextBudget = checkBudget(budgetText);
    setErrors({
      ...(nextGuests.ok ? {} : { guests: nextGuests.message }),
      ...(nextBudget.ok ? {} : { budget: nextBudget.message }),
    });
    if (!nextGuests.ok || !nextBudget.ok) return;
    const change = whatIfPatch(plan.profile, nextGuests.value, nextBudget.value);
    if (!change) {
      notify({ tone: 'info', text: 'Nothing changed.' });
      return;
    }
    patchWithRipple(change.patch, `What-if: ${change.summary}`);
  };

  return (
    <section className="card card--flat" aria-labelledby="whatif-title">
      <h2 id="whatif-title">What if…?</h2>
      <p className="muted small">
        Try a different headcount or budget. Every change can be undone from History.
      </p>
      <form
        className="row whatif"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          label="Guests"
          inputMode="numeric"
          className="field--narrow"
          value={guests}
          error={errors.guests}
          onChange={(event) => {
            setGuests(event.target.value);
          }}
        />
        <TextField
          label="Budget"
          inputMode="decimal"
          className="field--narrow"
          value={budgetText}
          error={errors.budget}
          onChange={(event) => {
            setBudgetText(event.target.value);
          }}
        />
        <Button type="submit">Apply</Button>
      </form>
    </section>
  );
}
