import { CATEGORY_LABELS } from '../../core/constants/enums';
import { formatDate, formatDateLong } from '../../core/dates';
import { formatInr } from '../../core/money';
import { displayTitle } from '../../core/profile';
import { useOpenPlan } from '../../state/PlanContext';

/** A compact, printable plan (Print → Save as PDF). Hidden on screen, shown by print.css. */
export function PrintSummary() {
  const { plan, derived } = useOpenPlan();
  const { budget, schedule, vendorBriefs } = derived;
  return (
    <section className="print-only" aria-hidden="true">
      <h1>{displayTitle(plan.profile)}</h1>
      <p>
        {formatDateLong(plan.profile.eventDate)} · {plan.profile.guests} guests · Budget{' '}
        {formatInr(budget.budget)} · Estimated {formatInr(budget.total)}
      </p>
      <h2>Budget</h2>
      <table>
        <tbody>
          {budget.lines.map((line) => (
            <tr key={line.category}>
              <td>{line.label}</td>
              <td>{line.basis === 'quote' ? `Quote (${line.quoteLabel ?? ''})` : 'Estimate'}</td>
              <td>{formatInr(line.amount)}</td>
            </tr>
          ))}
          <tr>
            <td>Buffer ({budget.contingencyPct}%)</td>
            <td />
            <td>{formatInr(budget.contingency)}</td>
          </tr>
          <tr>
            <td>
              <strong>Total</strong>
            </td>
            <td />
            <td>
              <strong>{formatInr(budget.total)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <h2>Timeline</h2>
      <ul>
        {schedule.tasks.map((task) => (
          <li key={task.id}>
            {task.done ? '☑' : '☐'} {formatDate(task.due)}: {task.title}
          </li>
        ))}
      </ul>
      <h2>Vendor checklist</h2>
      {vendorBriefs.map((brief) => (
        <div key={brief.category}>
          <h3>{CATEGORY_LABELS[brief.category]}</h3>
          <ul>
            {brief.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
