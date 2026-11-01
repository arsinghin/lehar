import { Button } from '../../components/Button';
import { formatDate } from '../../core/dates';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { UndoRedoButtons } from '../shared/UndoRedoButtons';

const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function when(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : TIME_FORMAT.format(date);
}

/** Every change is a version. Restoring is itself a change, so nothing is ever lost. */
export function HistoryView() {
  const { state, plan, dispatch } = useOpenPlan();
  const versions = state.past.map((snapshot, index) => ({ snapshot, index })).reverse();

  return (
    <div className="stack-l">
      <section className="stack" aria-labelledby="history-title">
        <h2 id="history-title">History</h2>
        <p className="muted">
          Every change you make is recorded here. Undo or redo step by step, or restore the plan as
          it was before any change. Planning started on {formatDate(plan.startDate)}.
        </p>
        <div className="row">
          <UndoRedoButtons />
        </div>
      </section>

      {versions.length === 0 ? (
        <p>
          No changes yet. When you change guests, budget, dates, tasks or quotes, they appear here.
        </p>
      ) : (
        <ol className="history-list" reversed>
          {versions.map(({ snapshot, index }) => (
            <li key={`${snapshot.at}-${String(index)}`} className="history-item">
              <div>
                <strong>{snapshot.reason}</strong>
                <div className="small muted">{when(snapshot.at)}</div>
              </div>
              <Button
                aria-label={`Restore the plan from before this: ${snapshot.reason}`}
                size="s"
                onClick={() => {
                  dispatch(actions.restore(index));
                }}
              >
                Restore the plan from before this
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
