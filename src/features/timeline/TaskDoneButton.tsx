import { Button } from '../../components/Button';
import type { ScheduledTask } from '../../core/timeline';
import { nowIso, usePlanStore } from '../../state/PlanContext';

export function TaskDoneButton({ task }: { task: ScheduledTask }) {
  const { dispatch } = usePlanStore();
  return (
    <Button
      aria-label={`Done: ${task.title}`}
      size="s"
      icon="check"
      onClick={() => {
        dispatch({
          type: 'task/setDone',
          taskId: task.id,
          title: task.title,
          done: true,
          at: nowIso(),
        });
      }}
    >
      Done
    </Button>
  );
}
