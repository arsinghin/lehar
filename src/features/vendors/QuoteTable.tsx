import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useNotify } from '../../components/Notice';
import { TableScroll } from '../../components/TableScroll';
import { QUOTE_STATUS_LABELS } from '../../core/constants/enums';
import { formatInr, formatNumber, formatSignedInr } from '../../core/money';
import type { Quote } from '../../core/schemas';
import type { QuoteComparison, QuoteRow as QuoteRowData } from '../../core/vendors';
import { usePlanStore } from '../../state/PlanContext';
import { actions } from '../../state/store';

export interface QuoteTableProps {
  comparison: QuoteComparison;
  /** The category's display label, e.g. "Food & catering". */
  label: string;
}

/** Quotes compared like for like: per guest, against the estimate, and what still needs checking. */
export function QuoteTable({ comparison, label }: QuoteTableProps) {
  if (comparison.rows.length === 0) {
    return (
      <p className="muted">
        No quotes yet. When vendors reply, add them here to compare like for like.
      </p>
    );
  }
  return (
    <TableScroll label={`Quotes for ${label}`}>
      <table>
        <caption className="visually-hidden">Quotes for {label}</caption>
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
            <QuoteRow
              key={row.quote.id}
              row={row}
              isLowestComplete={row.quote.id === comparison.lowestCompleteId}
              label={label}
            />
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

interface QuoteRowProps {
  row: QuoteRowData;
  isLowestComplete: boolean;
  label: string;
}

const dash = (value: number | null, format: (value: number) => string) =>
  value === null ? '—' : format(value);

function QuoteRow({ row, isLowestComplete, label }: QuoteRowProps) {
  const { quote } = row;
  return (
    <tr>
      <th scope="row">
        {quote.vendorLabel}
        {isLowestComplete ? (
          <div>
            <Badge tone="ok">Lowest complete quote</Badge>
          </div>
        ) : null}
        {quote.notes ? <div className="small muted">{quote.notes}</div> : null}
      </th>
      <td className="t-right num">{formatInr(quote.amount)}</td>
      <td className="t-right num">{dash(row.perGuest, formatInr)}</td>
      <td className="t-right num">{dash(row.vsTarget, formatSignedInr)}</td>
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
        {quote.guestsCovered !== null ? (
          <div className="small muted">Covers {formatNumber(quote.guestsCovered)} guests</div>
        ) : null}
      </td>
      <td>
        <div className="stack-s">
          <Badge tone={quote.status === 'accepted' ? 'ok' : 'neutral'}>
            {QUOTE_STATUS_LABELS[quote.status]}
          </Badge>
          <QuoteActions quote={quote} label={label} />
        </div>
      </td>
    </tr>
  );
}

/** Accept (it replaces the estimate in the budget), shortlist, or remove a quote. */
function QuoteActions({ quote, label }: { quote: Quote; label: string }) {
  const { dispatch } = usePlanStore();
  const notify = useNotify();
  const name = quote.vendorLabel;
  return (
    <div className="row">
      {quote.status !== 'accepted' ? (
        <Button
          aria-label={`Accept ${name}`}
          size="s"
          onClick={() => {
            dispatch(actions.setQuoteStatus(quote.id, 'accepted'));
            notify({
              tone: 'ok',
              text: `${name}'s quote now replaces the ${label.toLowerCase()} estimate in your budget.`,
            });
          }}
        >
          Accept
        </Button>
      ) : null}
      {quote.status === 'received' ? (
        <Button
          aria-label={`Shortlist ${name}`}
          size="s"
          variant="ghost"
          onClick={() => {
            dispatch(actions.setQuoteStatus(quote.id, 'shortlisted'));
          }}
        >
          Shortlist
        </Button>
      ) : null}
      <Button
        aria-label={`Remove ${name}`}
        size="s"
        variant="ghost"
        onClick={() => {
          dispatch(actions.removeQuote(quote.id));
        }}
      >
        Remove
      </Button>
    </div>
  );
}
