import { useState } from 'react';

import { Alert, Badge, SourceBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TableScroll } from '../../components/TableScroll';
import { useNotify } from '../../components/Notice';
import { googleMapsSearchUrl } from '../../core/calendar';
import { QUOTE_STATUS_LABELS, type Category } from '../../core/constants/enums';
import { formatInr, formatNumber, formatSignedInr } from '../../core/money';
import { compareQuotes, type VendorBrief } from '../../core/vendors';
import { AiInputError, fetchVendorQuestions } from '../../lib/aiActions';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { QuoteForm } from './QuoteForm';

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
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const extra = plan.vendorQuestions[brief.category];
  const comparison = compareQuotes(brief.category, plan.quotes, plan.profile.guests, brief.target);
  const headingId = `vendor-${brief.category}`;
  const mapsText = `Find ${brief.mapsQuery}${plan.profile.city ? ` near ${plan.profile.city}` : ''} on Google Maps`;

  const askAi = async () => {
    setLoading(true);
    try {
      const outcome = await fetchVendorQuestions(plan.profile, brief.category);
      dispatch({ type: 'vendorQuestions/set', category: brief.category, value: outcome.value });
      notify(
        outcome.notice
          ? { tone: 'info', text: outcome.notice }
          : {
              tone: 'ok',
              text: `Added questions tailored to your ${brief.label.toLowerCase()} needs.`,
            },
      );
    } catch (error) {
      notify({
        tone: 'danger',
        text: error instanceof AiInputError ? error.message : 'Could not get questions right now.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stack-l" aria-labelledby={headingId}>
      <div className="grid">
        <div className="card">
          <h3 id={headingId}>{brief.label}: what to ask for</h3>
          <ul>
            {brief.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {brief.target !== null ? (
            <p className="small">
              Your estimate: <strong className="num">{formatInr(brief.target)}</strong>{' '}
              <Badge tone="neutral">assumption</Badge>
            </p>
          ) : null}
          <a
            className="btn btn--ghost btn--s"
            href={googleMapsSearchUrl(brief.mapsQuery, plan.profile.city)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${mapsText} (opens in a new tab)`}
          >
            <Icon name="map" /> {mapsText}
          </a>
          <p className="small muted">
            Search results come from Google Maps. Lehar has not checked them.
          </p>
        </div>

        <div className="card">
          <h3>Questions to ask before booking</h3>
          <ol>
            {brief.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
          {extra && extra.questions.length > 0 ? (
            <>
              <div className="row">
                <h4>Specific to your event</h4>
                <SourceBadge source={extra.source} />
              </div>
              <ol>
                {extra.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            </>
          ) : null}
          <Button icon="sparkle" busy={loading} onClick={() => void askAi()}>
            {extra ? 'Suggest different questions' : 'Suggest questions for my event'}
          </Button>
        </div>
      </div>

      <section className="stack" aria-labelledby={`${headingId}-quotes`}>
        <h3 id={`${headingId}-quotes`}>Quotes</h3>
        {comparison.rows.length === 0 ? (
          <p className="muted">
            No quotes yet. When vendors reply, add them here to compare like for like.
          </p>
        ) : (
          <TableScroll label={`Quotes for ${brief.label}`}>
            <table>
              <caption className="visually-hidden">Quotes for {brief.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col" className="t-right">
                    Total
                  </th>
                  <th scope="col" className="t-right">
                    Per guest
                  </th>
                  <th scope="col" className="t-right">
                    vs estimate
                  </th>
                  <th scope="col">Check before booking</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.quote.id}>
                    <th scope="row">
                      {row.quote.vendorLabel}
                      {row.quote.id === comparison.lowestCompleteId ? (
                        <div>
                          <Badge tone="ok">Lowest complete quote</Badge>
                        </div>
                      ) : null}
                      {row.quote.notes ? (
                        <div className="small muted">{row.quote.notes}</div>
                      ) : null}
                    </th>
                    <td className="t-right num">{formatInr(row.quote.amount)}</td>
                    <td className="t-right num">
                      {row.perGuest === null ? '—' : formatInr(row.perGuest)}
                    </td>
                    <td className="t-right num">
                      {row.vsTarget === null ? '—' : formatSignedInr(row.vsTarget)}
                    </td>
                    <td>
                      {row.flags.length === 0 ? (
                        <Badge tone="ok" icon="check">
                          Looks complete
                        </Badge>
                      ) : (
                        <ul className="flag-list small">
                          {row.flags.map((flag) => (
                            <li key={flag}>{flag}</li>
                          ))}
                        </ul>
                      )}
                      {row.quote.guestsCovered !== null ? (
                        <div className="small muted">
                          Covers {formatNumber(row.quote.guestsCovered)} guests
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="stack-s">
                        <Badge tone={row.quote.status === 'accepted' ? 'ok' : 'neutral'}>
                          {QUOTE_STATUS_LABELS[row.quote.status]}
                        </Badge>
                        <div className="row">
                          {row.quote.status !== 'accepted' ? (
                            <Button
                              aria-label={`Accept ${row.quote.vendorLabel}`}
                              size="s"
                              onClick={() => {
                                dispatch({
                                  type: 'quote/setStatus',
                                  id: row.quote.id,
                                  status: 'accepted',
                                  at: nowIso(),
                                });
                                notify({
                                  tone: 'ok',
                                  text: `${row.quote.vendorLabel}'s quote now replaces the ${brief.label.toLowerCase()} estimate in your budget.`,
                                });
                              }}
                            >
                              Accept
                            </Button>
                          ) : null}
                          {row.quote.status === 'received' ? (
                            <Button
                              aria-label={`Shortlist ${row.quote.vendorLabel}`}
                              size="s"
                              variant="ghost"
                              onClick={() => {
                                dispatch({
                                  type: 'quote/setStatus',
                                  id: row.quote.id,
                                  status: 'shortlisted',
                                  at: nowIso(),
                                });
                              }}
                            >
                              Shortlist
                            </Button>
                          ) : null}
                          <Button
                            aria-label={`Remove ${row.quote.vendorLabel}`}
                            size="s"
                            variant="ghost"
                            onClick={() => {
                              dispatch({ type: 'quote/remove', id: row.quote.id, at: nowIso() });
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
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
