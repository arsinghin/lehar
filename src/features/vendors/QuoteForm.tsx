import { useState } from 'react';

import { Button } from '../../components/Button';
import { CheckboxGroup } from '../../components/ChoiceGroup';
import { TextField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { LIMITS } from '../../core/constants/limits';
import { formatInr } from '../../core/money';
import type { VendorBrief } from '../../core/vendors';
import { newId } from '../../lib/util';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import {
  EMPTY_QUOTE_DRAFT,
  quoteFromDraft,
  type QuoteDraft,
  type QuoteDraftErrors,
} from './quoteDraft';

/** Records a quote exactly as the vendor gave it. Lehar never fills in prices itself. */
export function QuoteForm({ brief }: { brief: VendorBrief }) {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [draft, setDraft] = useState<QuoteDraft>(EMPTY_QUOTE_DRAFT);
  const [errors, setErrors] = useState<QuoteDraftErrors>({});
  const prefix = `quote-${brief.category}`;
  const atLimit = plan.quotes.length >= LIMITS.maxQuotes;
  const update = (patch: Partial<QuoteDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    const result = quoteFromDraft(draft, brief.category, newId());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const { quote } = result;
    setErrors({});
    dispatch(actions.addQuote(quote));
    notify({
      tone: 'ok',
      text: `Added ${quote.vendorLabel}'s quote of ${formatInr(quote.amount)}. Compare it below, or accept it to use it in the budget.`,
    });
    setDraft(EMPTY_QUOTE_DRAFT);
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
          <QuoteFields
            prefix={prefix}
            draft={draft}
            errors={errors}
            inclusions={brief.inclusions}
            update={update}
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

interface QuoteFieldsProps {
  prefix: string;
  draft: QuoteDraft;
  errors: QuoteDraftErrors;
  /** Items this kind of vendor's quote should state. */
  inclusions: readonly string[];
  update: (patch: Partial<QuoteDraft>) => void;
}

function QuoteFields({ prefix, draft, errors, inclusions, update }: QuoteFieldsProps) {
  return (
    <>
      <div className="row">
        <TextField
          id={`${prefix}-label`}
          label="Vendor"
          hint="A name or label you will recognise"
          maxLength={LIMITS.maxQuoteLabel}
          value={draft.vendorLabel}
          error={errors.vendorLabel}
          onChange={(event) => {
            update({ vendorLabel: event.target.value });
          }}
        />
        <TextField
          id={`${prefix}-amount`}
          label="Quoted total"
          hint="For example “2.3 lakh” or “₹2,30,000”"
          inputMode="decimal"
          value={draft.amount}
          error={errors.amount}
          onChange={(event) => {
            update({ amount: event.target.value });
          }}
        />
        <TextField
          id={`${prefix}-guests`}
          label="Guests covered (optional)"
          inputMode="numeric"
          value={draft.guestsCovered}
          error={errors.guestsCovered}
          onChange={(event) => {
            update({ guestsCovered: event.target.value });
          }}
        />
      </div>
      <CheckboxGroup
        legend="What does the quote clearly include?"
        hint="Anything not ticked is flagged as “clarify before booking”."
        name={`${prefix}-inclusions`}
        value={draft.inclusions}
        options={inclusions.map((item) => ({ value: item, label: item }))}
        onChange={(inclusions) => {
          update({ inclusions });
        }}
      />
      <TextField
        id={`${prefix}-notes`}
        label="Notes (optional)"
        maxLength={LIMITS.maxQuoteNotes}
        value={draft.notes}
        onChange={(event) => {
          update({ notes: event.target.value });
        }}
      />
    </>
  );
}
