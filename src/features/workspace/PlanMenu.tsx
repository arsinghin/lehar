import { useRef, type ChangeEvent } from 'react';

import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useNotify } from '../../components/Notice';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { exportIcs } from '../timeline/exportIcs';
import { loadPlanFile, savePlanFile } from './planFile';

export interface PlanMenuProps {
  title: string;
  onNewPlan: () => void;
}

/** The "More" menu: export, save, load, print and start over. */
export function PlanMenu({ title, onNewPlan }: PlanMenuProps) {
  const { plan, derived, dispatch } = useOpenPlan();
  const notify = useNotify();
  const fileInput = useRef<HTMLInputElement>(null);

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const loaded = await loadPlanFile(file);
    if (!loaded.ok) {
      notify({ tone: 'danger', text: loaded.message });
      return;
    }
    dispatch(actions.openPlan(loaded.plan, loaded.reason));
    notify({ tone: 'ok', text: 'Plan loaded. Your previous plan is in History.' });
  };

  return (
    <>
      <details className="menu">
        <summary className="btn btn--ghost">
          <Icon name="menu" /> More
        </summary>
        <div className="menu__panel">
          <Button
            variant="ghost"
            icon="calendar"
            onClick={() => {
              exportIcs(title, plan.profile.eventDate, derived.schedule.tasks);
            }}
          >
            Export calendar (.ics)
          </Button>
          <Button
            variant="ghost"
            icon="download"
            onClick={() => {
              savePlanFile(plan, title);
            }}
          >
            Save plan as a file
          </Button>
          <Button variant="ghost" icon="upload" onClick={() => fileInput.current?.click()}>
            Load a plan file
          </Button>
          <Button
            variant="ghost"
            icon="printer"
            onClick={() => {
              window.print();
            }}
          >
            Print or save as PDF
          </Button>
          <Button variant="ghost" icon="plus" onClick={onNewPlan}>
            Start a new plan
          </Button>
        </div>
      </details>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Load a plan file"
        onChange={(event) => void onImport(event)}
      />
    </>
  );
}
