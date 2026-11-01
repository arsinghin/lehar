import { Button } from '../../components/Button';
import { fetchVendorQuestions } from '../../lib/aiActions';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { SourceBadge } from '../shared/StatusBadges';
import { useAiAction } from '../shared/useAiAction';
import type { VendorBrief } from '../../core/vendors';

/** The standard checklist for a vendor, plus questions the AI tailors to this event. */
export function VendorQuestions({ brief }: { brief: VendorBrief }) {
  const { plan } = useOpenPlan();
  const ai = useAiAction();
  const extra = plan.vendorQuestions[brief.category];

  const suggest = () =>
    ai.run('questions', {
      request: () => fetchVendorQuestions(plan.profile, brief.category),
      save: (value) => actions.setVendorQuestions(brief.category, value),
      success: `Added questions tailored to your ${brief.label.toLowerCase()} needs.`,
      failure: 'Could not get questions right now.',
    });

  return (
    <div className="card">
      <h3>Questions to ask before booking</h3>
      <ol>
        {brief.questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ol>
      {extra && extra.questions.length > 0 ? (
        <>
          <div className="row">
            <h4>Specific to your event</h4>
            <SourceBadge source={extra.source} />
          </div>
          <ol>
            {extra.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </>
      ) : null}
      <Button icon="sparkle" busy={ai.pending !== null} onClick={() => void suggest()}>
        {extra ? 'Suggest different questions' : 'Suggest questions for my event'}
      </Button>
    </div>
  );
}
