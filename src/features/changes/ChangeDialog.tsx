import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Dialog } from '../../components/Dialog';
import { TextAreaField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { LIMITS } from '../../core/constants/limits';
import { SAMPLE_CHANGE_TEXT } from '../../core/demo';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { InterpretationResult } from './InterpretationResult';
import { useChangePreview } from './useChangePreview';

const EXAMPLES = [
  { label: '50 more guests', text: '50 more guests' },
  { label: 'Budget down 10%', text: 'Budget down 10%' },
  { label: '2 weeks earlier', text: '2 weeks earlier' },
  { label: 'Budget is now 7 lakh', text: 'Budget is now 7 lakh' },
  { label: 'All three at once', text: SAMPLE_CHANGE_TEXT },
] as const;

export interface ChangeDialogProps {
  open: boolean;
  initialText: string;
  onClose: () => void;
}

/** "Something changed?": describe a change, preview every ripple, then apply it or cancel. */
export function ChangeDialog({ open, initialText, onClose }: ChangeDialogProps) {
  return (
    <Dialog open={open} title="Something changed?" onClose={onClose}>
      {open ? <ChangeFlow initialText={initialText} onClose={onClose} /> : null}
    </Dialog>
  );
}

function ChangeFlow({ initialText, onClose }: Omit<ChangeDialogProps, 'open'>) {
  const { dispatch } = useOpenPlan();
  const notify = useNotify();
  const change = useChangePreview(initialText);
  const { result, diff } = change;

  const apply = () => {
    if (!result || !diff) return;
    const summary = result.resolved.summary.join('; ');
    const over = diff.budget.after.status === 'over';
    dispatch(actions.patchPlan(result.resolved.patch, `Change: ${summary}`));
    notify({
      tone: over ? 'warn' : 'ok',
      text: `Applied: ${summary}. ${over ? 'Open Budget to choose trade-offs.' : 'The plan still fits.'} You can undo this from History.`,
    });
    onClose();
  };

  return (
    <div className="stack">
      <p className="muted">
        Describe it the way you would tell a friend. Lehar works out the ripple first. Nothing
        changes until you apply it.
      </p>
      <form
        noValidate
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void change.preview();
        }}
      >
        <TextAreaField
          label="What changed?"
          hint="Guests, budget or date. You can mention several at once."
          rows={3}
          maxLength={LIMITS.maxChangeText}
          value={change.text}
          error={change.inputError}
          onChange={(event) => {
            change.setText(event.target.value);
          }}
        />
        <div className="row" role="group" aria-label="Examples">
          {EXAMPLES.map((example) => (
            <Chip
              key={example.label}
              onClick={() => {
                change.setText(example.text);
              }}
            >
              {example.label}
            </Chip>
          ))}
        </div>
        <div>
          <Button
            type="submit"
            variant={result ? 'secondary' : 'primary'}
            icon="ripple"
            busy={change.pending}
          >
            Preview the ripple
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="stack">
        <InterpretationResult result={result} diff={diff} />
      </div>

      <div className="dialog__actions row">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" icon="check" disabled={!diff} onClick={apply}>
          Apply changes
        </Button>
      </div>
    </div>
  );
}
