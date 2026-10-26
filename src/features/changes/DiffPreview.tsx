import { Alert, Badge, BudgetStatusBadge } from '../../components/Badge';
import type { PlanDiff } from '../../core/changes/diff';
import { TableScroll } from '../../components/TableScroll';
import { formatDate } from '../../core/dates';
import { formatInr, formatSignedInr } from '../../core/money';

/** Shows every ripple of a proposed change: fields, budget, timeline, vendors and what is kept. */
export function DiffPreview({ diff }: { diff: PlanDiff }) {
  const { budget, schedule } = diff;
  const shownLines = budget.lines.slice(0, 5);
  return (
    <div className="stack diff">
      <section aria-labelledby="diff-fields">
        <h3 id="diff-fields">What changes</h3>
        <ul className="diff__fields">
          {diff.fieldChanges.map((change) => (
            <li key={change.field}>
              <strong>{change.label}:</strong> <span className="num">{change.from}</span> →{' '}
              <span className="num">{change.to}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="diff-budget">
        <h3 id="diff-budget">Budget ripple</h3>
        <p>
          Estimated total <span className="num">{formatInr(budget.before.total)}</span> →{' '}
          <strong className="num">{formatInr(budget.after.total)}</strong> against{' '}
          <span className="num">{formatInr(budget.after.budget)}</span>.{' '}
          <BudgetStatusBadge status={budget.after.status} />
        </p>
        {shownLines.length > 0 ? (
          <TableScroll label="Budget lines that change">
            <table>
              <caption className="visually-hidden">Budget lines that change</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="t-right">
                    Before
                  </th>
                  <th scope="col" className="t-right">
                    After
                  </th>
                  <th scope="col" className="t-right">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownLines.map((line) => (
                  <tr key={line.category}>
                    <th scope="row">{line.label}</th>
                    <td className="t-right num">{formatInr(line.before)}</td>
                    <td className="t-right num">{formatInr(line.after)}</td>
                    <td className="t-right num">{formatSignedInr(line.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : null}
        {budget.after.status === 'over' ? (
          <Alert tone="warn">
            <p>
              You would be {formatInr(budget.after.gap)} over. After you apply, the Budget tab shows
              trade-offs ranked by what matters to you.
            </p>
          </Alert>
        ) : null}
      </section>

      <section aria-labelledby="diff-timeline">
        <h3 id="diff-timeline">Timeline ripple</h3>
        <ul>
          <li>
            Days to go: <span className="num">{schedule.daysLeftBefore}</span> →{' '}
            <strong className="num">{schedule.daysLeftAfter}</strong>
          </li>
          {schedule.movedTasks > 0 ? <li>{schedule.movedTasks} task deadlines move.</li> : null}
          {schedule.becameCompressed ? (
            <li>
              <Badge tone="warn">Compressed</Badge> There is now less time than ideal, so every
              deadline tightens.
            </li>
          ) : null}
        </ul>
        {schedule.newlyOverdue.length > 0 ? (
          <Alert
            tone="danger"
            title={`${schedule.newlyOverdue.length} task(s) would become overdue`}
          >
            <ul>
              {schedule.newlyOverdue.map((task) => (
                <li key={task.id}>
                  {task.title}: due {formatDate(task.due)}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </section>

      {diff.requotes.length > 0 ? (
        <section aria-labelledby="diff-vendors">
          <h3 id="diff-vendors">Vendors to contact</h3>
          <ul>
            {diff.requotes.map((notice) => (
              <li key={notice.quoteId}>
                <strong>{notice.vendorLabel}:</strong> {notice.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="small muted">
        Kept as they are: {diff.kept.doneTasks} completed task{diff.kept.doneTasks === 1 ? '' : 's'}
        , {diff.kept.quotes} quote
        {diff.kept.quotes === 1 ? '' : 's'}
        {diff.kept.hasIdeas ? ' and your ideas' : ''}. Nothing is rebuilt from scratch.
      </p>
    </div>
  );
}
