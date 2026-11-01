import { Button } from '../../components/Button';
import { usePlanStore } from '../../state/PlanContext';
import { actions } from '../../state/store';

/** Undo and Redo, disabled when there is nothing to step through. */
export function UndoRedoButtons() {
  const { state, dispatch } = usePlanStore();
  return (
    <>
      <Button
        icon="undo"
        disabled={state.past.length === 0}
        onClick={() => {
          dispatch(actions.undo());
        }}
      >
        Undo
      </Button>
      <Button
        icon="redo"
        disabled={state.future.length === 0}
        onClick={() => {
          dispatch(actions.redo());
        }}
      >
        Redo
      </Button>
    </>
  );
}
