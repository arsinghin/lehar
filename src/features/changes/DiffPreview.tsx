import { useId, type ReactNode } from 'react';

import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { TableScroll } from '../../components/TableScroll';
import type { PlanDiff } from '../../core/changes/diff';
import { formatDate } from '../../core/dates';
import { formatInr, formatSignedInr } from '../../core/money';
import { plural } from '../../lib/util';
import { BudgetStatusBadge } from '../shared/StatusBadges';

/** The largest line changes are shown; the rest are summarised by the new total. */
const MAX_LINES_SHOWN = 5;

function DiffSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      {children}
    </section>
  );
}

function BudgetRipple({ budget }: { budget: PlanDiff['budget'] }) {
  const lines = budget.lines.slice(0, MAX_LINES_SHOWN);
  return (
    <DiffSection title="Budget ripple">
      <p>
        Estimated total <span className="num">{formatInr(budget.before.total)}</span> →{' '}
        <strong className="num">{formatInr(budget.after.total)}</strong> against{' '}
        <span className="num">{formatInr(budget.after.budget)}</span>.{' '}
        <BudgetStatusBadge status={budget.after.status} />
      </p>
      {lines.length > 0 ? (
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
              {lines.map((line) => (
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
    </DiffSection>
  );
}

function TimelineRipple({ schedule }: { schedule: PlanDiff['schedule'] }) {
  const overdue = schedule.newlyOverdue;
  return (
    <DiffSection title="Timeline ripple">
      <ul>
        <li>
          Days to go: <span className="num">{schedule.daysLeftBefore}</span> →{' '}
          <strong className="num">{schedule.daysLeftAfter}</strong>
        </li>
        {schedule.movedTasks > 0 ? (
          <li>
            {plural(schedule.movedTasks, 'task deadline')}{' '}
            {schedule.movedTasks === 1 ? 'moves' : 'move'}.
          </li>
        ) : null}
        {schedule.becameCompressed ? (
          <li>
            <Badge tone="warn">Compressed</Badge> There is now less time than ideal, so every
            deadline tightens.
          </li>
        ) : null}
      </ul>
      {overdue.length > 0 ? (
        <Alert tone="danger" title={`${plural(overdue.length, 'task')} would become overdue`}>
          <ul>
            {overdue.map((task) => (
              <li key={task.id}>
                {task.title}: due {formatDate(task.due)}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </DiffSection>
  );
}

/** Shows every ripple of a proposed change: fields, budget, timeline, vendors and what is kept. */
export function DiffPreview({ diff }: { diff: PlanDiff }) {
  const { kept } = diff;
  return (
    <div className="stack diff">
      <DiffSection title="What changes">
        <ul className="diff__fields">
          {diff.fieldChanges.map((change) => (
            <li key={change.field}>
              <strong>{change.label}:</strong> <span className="num">{change.from}</span> →{' '}
              <span className="num">{change.to}</span>
            </li>
          ))}
        </ul>
      </DiffSection>
      <BudgetRipple budget={diff.budget} />
      <TimelineRipple schedule={diff.schedule} />
      {diff.requotes.length > 0 ? (
        <DiffSection title="Vendors to contact">
          <ul>
            {diff.requotes.map((notice) => (
              <li key={notice.quoteId}>
                <strong>{notice.vendorLabel}:</strong> {notice.reason}
              </li>
            ))}
          </ul>
        </DiffSection>
      ) : null}
      <p className="small muted">
        Kept as they are: {plural(kept.doneTasks, 'completed task')}, {plural(kept.quotes, 'quote')}
        {kept.hasIdeas ? ' and your ideas' : ''}. Nothing is rebuilt from scratch.
      </p>
    </div>
  );
}
