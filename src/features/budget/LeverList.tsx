import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { formatInr } from '../../core/money';
import { isRatedLever, type Lever } from '../../core/tradeoffs';
import { toggleItem } from '../../lib/util';

export interface LeverListProps {
  levers: readonly Lever[];
  suggestedIds: readonly string[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

/** A lever conflicts with a chosen one when both touch the same category. */
function conflictsWithChoice(lever: Lever, levers: readonly Lever[], selected: readonly string[]) {
  return (
    lever.category !== undefined &&
    levers.some(
      (other) =>
        other.id !== lever.id && selected.includes(other.id) && other.category === lever.category,
    )
  );
}

/** Each trade-off as a checkbox (or a note when nothing is left to trim), with what it saves and which of the host's priorities it touches. */
export function LeverList({ levers, suggestedIds, selected, onChange }: LeverListProps) {
  if (levers.length === 0) {
    return (
      <Alert tone="warn" title="Nothing left to trim">
        <p>
          Everything left is protected or already at its simplest. Consider raising the budget or
          unprotecting an area.
        </p>
      </Alert>
    );
  }
  return (
    <fieldset>
      <legend>Choose the trade-offs you are comfortable with</legend>
      <ul className="lever-list">
        {levers.map((lever) => {
          const checked = selected.includes(lever.id);
          return (
            <li key={lever.id}>
              <label className="choice lever">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && conflictsWithChoice(lever, levers, selected)}
                  onChange={() => {
                    onChange(toggleItem(selected, lever.id, !checked));
                  }}
                />
                <span className="choice__text">
                  <span>
                    <strong>{lever.title}</strong>{' '}
                    {suggestedIds.includes(lever.id) ? <Badge tone="info">Suggested</Badge> : null}
                  </span>
                  <span className="choice__desc">{lever.detail}</span>
                  <span className="small">
                    Saves about <strong className="num">{formatInr(lever.saving)}</strong>
                    {isRatedLever(lever)
                      ? ` · you rated this ${String(Math.floor(lever.pain))} of 5`
                      : ''}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
