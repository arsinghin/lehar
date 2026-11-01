import { useState } from 'react';

import { Alert } from '../../components/Alert';
import type { Category } from '../../core/constants/enums';
import { compareQuotes, type VendorBrief } from '../../core/vendors';
import { useOpenPlan } from '../../state/PlanContext';
import { QuoteForm } from './QuoteForm';
import { QuoteTable } from './QuoteTable';
import { RequirementSheet } from './RequirementSheet';
import { VendorQuestions } from './VendorQuestions';

/** One tab per vendor category: requirements, questions to ask, and quote comparison. */
export function VendorsView() {
  const { derived } = useOpenPlan();
  const briefs = derived.vendorBriefs;
  const [active, setActive] = useState<Category | undefined>(briefs[0]?.category);
  const brief = briefs.find((item) => item.category === active) ?? briefs[0];

  if (!brief) return <p>No vendor categories are active in this plan.</p>;

  return (
    <div className="stack-l">
      <section className="stack" aria-labelledby="vendors-title">
        <h2 id="vendors-title">Vendors</h2>
        <p className="muted">
          Lehar is your coordinator, not a marketplace. It tells you what to ask for, what to ask
          and how quotes compare. It never claims a vendor is available or a price is confirmed.
        </p>
        <div className="segmented" role="group" aria-label="Vendor category">
          {briefs.map((item) => (
            <button
              key={item.category}
              type="button"
              className="segmented__item"
              aria-pressed={item.category === brief.category}
              onClick={() => {
                setActive(item.category);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <VendorCategory key={brief.category} brief={brief} />
    </div>
  );
}

function VendorCategory({ brief }: { brief: VendorBrief }) {
  const { plan } = useOpenPlan();
  const comparison = compareQuotes(brief.category, plan.quotes, plan.profile.guests, brief.target);
  const headingId = `vendor-${brief.category}`;

  return (
    <section className="stack-l" aria-labelledby={headingId}>
      <div className="grid">
        <RequirementSheet brief={brief} city={plan.profile.city} headingId={headingId} />
        <VendorQuestions brief={brief} />
      </div>
      <section className="stack" aria-labelledby={`${headingId}-quotes`}>
        <h3 id={`${headingId}-quotes`}>Quotes</h3>
        <QuoteTable comparison={comparison} label={brief.label} />
        <QuoteForm brief={brief} />
        <Alert tone="info">
          <p className="small">
            Lehar does not check vendor availability or prices. Always confirm the date, inclusions
            and cancellation terms in writing before paying an advance.
          </p>
        </Alert>
      </section>
    </section>
  );
}
