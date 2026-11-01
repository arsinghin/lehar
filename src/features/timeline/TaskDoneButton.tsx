import { Button } from '../../components/Button';
import type { ScheduledTask } from '../../core/timeline';
import { usePlanStore } from '../../state/PlanContext';
import { actions } from '../../state/store';

/** A one-click "Done" for a task shown outside the Timeline tab (e.g. Overview's "Do next"). */
export function TaskDoneButton({ task }: { task: ScheduledTask }) {
  const { dispatch } = usePlanStore();
  return (
    <Button
      aria-label={`Done: ${task.title}`}
      size="s"
      icon="check"
      onClick={() => {
        dispatch(actions.setTaskDone(task.id, task.title, true));
      }}
    >
      Done
    </Button>
  );
}
