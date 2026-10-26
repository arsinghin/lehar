import { useState } from 'react';

import { Button } from '../../components/Button';
import { CheckboxGroup } from '../../components/ChoiceGroup';
import { TextField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { LIMITS } from '../../core/constants/limits';
import { formatInr, parseInrAmount } from '../../core/money';
import type { Quote } from '../../core/schemas';
import type { VendorBrief } from '../../core/vendors';
import { newId } from '../../lib/util';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { parseGuests } from '../intake/intakeDraft';

interface Errors {
  vendorLabel?: string;
  amount?: string;
  guestsCovered?: string;
}

/** Records a quote exactly as the vendor gave it. Lehar never fills in prices itself. */
export function QuoteForm({ brief }: { brief: VendorBrief }) {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [vendorLabel, setVendorLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [guestsCovered, setGuestsCovered] = useState('');
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const prefix = `quote-${brief.category}`;
  const atLimit = plan.quotes.length >= LIMITS.maxQuotes;

  const submit = () => {
    const next: Errors = {};
    const label = vendorLabel.trim();
    const value = parseInrAmount(amount);
    const covered = guestsCovered.trim() === '' ? null : parseGuests(guestsCovered);
    if (!label) next.vendorLabel = 'Give the vendor a name or label.';
    if (value === null || value <= 0 || value > LIMITS.maxBudget)
      next.amount = 'Enter the quoted total, for example “2.3 lakh”.';
    if (guestsCovered.trim() !== '' && (covered === null || covered > LIMITS.maxGuests))
      next.guestsCovered = 'Enter a whole number of guests.';
    setErrors(next);
    if (Object.keys(next).length > 0 || value === null) return;
    const quote: Quote = {
      id: newId(),
      category: brief.category,
      vendorLabel: label.slice(0, LIMITS.maxQuoteLabel),
      amount: value,
      guestsCovered: covered,
      inclusions,
      notes: notes.trim().slice(0, LIMITS.maxQuoteNotes),
      status: 'received',
    };
    dispatch({ type: 'quote/add', quote, at: nowIso() });
    notify({
      tone: 'ok',
      text: `Added ${label}'s quote of ${formatInr(value)}. Compare it below, or accept it to use it in the budget.`,
    });
    setVendorLabel('');
    setAmount('');
    setGuestsCovered('');
    setInclusions([]);
    setNotes('');
  };

  return (
    <details className="details">
      <summary>Add a quote you received</summary>
      {atLimit ? (
        <p>You have reached {LIMITS.maxQuotes} quotes. Remove one to add another.</p>
      ) : (
        <form
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="row">
            <TextField
              id={`${prefix}-label`}
              label="Vendor"
              hint="A name or label you will recognise"
              maxLength={LIMITS.maxQuoteLabel}
              value={vendorLabel}
              error={errors.vendorLabel}
              onChange={(event) => {
                setVendorLabel(event.target.value);
              }}
            />
            <TextField
              id={`${prefix}-amount`}
              label="Quoted total"
              hint="For example “2.3 lakh” or “₹2,30,000”"
              inputMode="decimal"
              value={amount}
              error={errors.amount}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
            />
            <TextField
              id={`${prefix}-guests`}
              label="Guests covered (optional)"
              inputMode="numeric"
              value={guestsCovered}
              error={errors.guestsCovered}
              onChange={(event) => {
                setGuestsCovered(event.target.value);
              }}
            />
          </div>
          <CheckboxGroup
            legend="What does the quote clearly include?"
            hint="Anything not ticked is flagged as “clarify before booking”."
            name={`${prefix}-inclusions`}
            value={inclusions}
            options={brief.inclusions.map((item) => ({ value: item, label: item }))}
            onChange={setInclusions}
          />
          <TextField
            id={`${prefix}-notes`}
            label="Notes (optional)"
            maxLength={LIMITS.maxQuoteNotes}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
          />
          <div>
            <Button type="submit" variant="primary" icon="plus">
              Add quote
            </Button>
          </div>
        </form>
      )}
    </details>
  );
}
