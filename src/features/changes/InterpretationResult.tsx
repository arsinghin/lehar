import { Alert } from '../../components/Alert';
import type { PlanDiff } from '../../core/changes/diff';
import { SourceBadge } from '../shared/StatusBadges';
import { DiffPreview } from './DiffPreview';
import type { Interpretation } from './useChangePreview';

export interface InterpretationResultProps {
  result: Interpretation | null;
  diff: PlanDiff | null;
}

function MessageList({ items }: { items: readonly string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** What Lehar understood: a question back, an impossible change, or the full ripple preview. */
export function InterpretationResult({ result, diff }: InterpretationResultProps) {
  if (!result) return null;
  const { notice, clarifications, resolved, source } = result;
  return (
    <>
      {notice ? (
        <Alert tone="info">
          <p>{notice}</p>
        </Alert>
      ) : null}
      {clarifications.length > 0 && !diff ? (
        <Alert tone="warn" title="Lehar needs a little more detail">
          <MessageList items={clarifications} />
        </Alert>
      ) : null}
      {resolved.errors.length > 0 ? (
        <Alert tone="danger" title="That change is not possible">
          <MessageList items={resolved.errors} />
        </Alert>
      ) : null}
      {diff ? (
        <>
          <div className="row">
            <strong>Understood as:</strong> <SourceBadge source={source} />
          </div>
          {source !== 'rules' ? (
            <p className="small">
              Interpreted by AI. Please check that this matches what you meant.
            </p>
          ) : null}
          {clarifications.length > 0 ? (
            <p className="small">Also: {clarifications.join(' ')}</p>
          ) : null}
          <DiffPreview diff={diff} />
        </>
      ) : null}
    </>
  );
}
