import { Alert } from '../../components/Alert';
import type { StorageIssue } from '../../state/PlanContext';

/** Tells the host when their plan is not being saved, or when a saved plan had to be discarded. */
export function StorageWarnings({ issue }: { issue: StorageIssue }) {
  if (issue === 'unavailable') {
    return (
      <Alert tone="warn" title="Your browser is not saving this plan">
        <p>
          Storage is blocked, so the plan will be lost when you close this tab. Use “More → Save
          plan as a file”.
        </p>
      </Alert>
    );
  }
  if (issue === 'invalid') {
    return (
      <Alert tone="warn" title="A saved plan could not be read">
        <p>It looked damaged, so Lehar started fresh to keep your data safe.</p>
      </Alert>
    );
  }
  return null;
}
