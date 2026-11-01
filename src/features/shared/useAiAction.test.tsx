import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { plan } from '../../../tests/fixtures';
import { renderWithPlan } from '../../../tests/render';
import type { IdeaSet } from '../../core/schemas';
import type { AiOutcome } from '../../lib/aiActions';
import { AiInputError } from '../../lib/aiActions';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { useAiAction } from './useAiAction';

const IDEAS: IdeaSet = {
  items: [
    {
      title: 'Garden mela',
      summary: 'Stalls under the trees.',
      decor: '',
      food: '',
      activity: '',
      whyItFits: '',
      costLevel: 'similar',
    },
  ],
  source: 'gemini',
};

/** Starts one AI request on click; a second button edits the plan while it is out. */
function Harness({ request }: { request: () => Promise<AiOutcome<IdeaSet>> }) {
  const { plan: open, dispatch } = useOpenPlan();
  const ai = useAiAction();
  return (
    <>
      <p>Ideas: {open.ideas ? open.ideas.items.length : 0}</p>
      <p>Pending: {ai.pending ?? 'none'}</p>
      <button
        type="button"
        onClick={() =>
          void ai.run('ideas', {
            request,
            save: actions.setIdeas,
            success: 'Saved.',
            failure: 'Failed.',
          })
        }
      >
        Ask
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.patchPlan({ guests: open.profile.guests + 10 }, 'More guests'));
        }}
      >
        Edit
      </button>
    </>
  );
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('useAiAction', () => {
  it('saves the answer, shows the success notice and tracks the pending key', async () => {
    const user = userEvent.setup();
    const answer = deferred<AiOutcome<IdeaSet>>();
    renderWithPlan(<Harness request={() => answer.promise} />, { plan: plan(), withNotice: true });
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByText('Pending: ideas')).toBeInTheDocument();
    await act(async () => {
      answer.resolve({ value: IDEAS, notice: null });
      await answer.promise;
    });
    expect(screen.getByText('Ideas: 1')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    expect(screen.getByText('Pending: none')).toBeInTheDocument();
  });

  it('drops an answer that arrives after the plan changed', async () => {
    const user = userEvent.setup();
    const answer = deferred<AiOutcome<IdeaSet>>();
    renderWithPlan(<Harness request={() => answer.promise} />, { plan: plan(), withNotice: true });
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await act(async () => {
      answer.resolve({ value: IDEAS, notice: null });
      await answer.promise;
    });
    expect(screen.getByText('Ideas: 0')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/plan changed while waiting/);
  });

  it('shows rejected input as is, and anything else as the failure message', async () => {
    const user = userEvent.setup();
    let fail: Error = new AiInputError('Please describe your event in your own words.');
    renderWithPlan(<Harness request={() => Promise.reject(fail)} />, {
      plan: plan(),
      withNotice: true,
    });
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/in your own words/);
    fail = new Error('boom');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Failed.')).toBeInTheDocument();
  });
});
