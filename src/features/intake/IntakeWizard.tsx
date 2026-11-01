import { useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { ErrorSummary } from '../../components/ErrorSummary';
import type { EventType } from '../../core/constants/enums';
import type { IsoDate } from '../../core/dates';
import type { EventProfile } from '../../core/schemas';
import type { FieldError } from '../../core/validation';
import {
  draftToProfile,
  initialDraft,
  LAST_STEP,
  STEPS,
  validateStep,
  withEventType,
  type IntakeDraft,
  type StepId,
} from './intakeDraft';
import { OccasionStep } from './steps/OccasionStep';
import { PeopleStep } from './steps/PeopleStep';
import { PrioritiesStep } from './steps/PrioritiesStep';
import { ReviewStep } from './steps/ReviewStep';
import { SizeStep } from './steps/SizeStep';
import type { StepProps } from './steps/stepProps';

export interface IntakeWizardProps {
  today: IsoDate;
  onCreate: (profile: EventProfile) => void;
  onCancel: () => void;
}

/** Five short steps that ask the practical questions first, then build the plan. */
export function IntakeWizard({ today, onCreate, onCancel }: IntakeWizardProps) {
  const [draft, setDraft] = useState<IntakeDraft>(() => initialDraft(today));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isReview = step === LAST_STEP;
  const current = STEPS[step] ?? STEPS[0];

  const update = (patch: Partial<IntakeDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
  };
  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;

  const goTo = (next: number) => {
    setErrors([]);
    setStep(Math.min(Math.max(next, 0), LAST_STEP));
    // Move focus to the new step heading so keyboard and screen-reader users know where they are.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    const stepErrors = validateStep(step, draft, today);
    setErrors(stepErrors);
    setAttempt((count) => count + 1);
    if (stepErrors.length === 0) goTo(step + 1);
  };

  const profile = isReview ? draftToProfile(draft, today) : null;
  const stepProps = { draft, update, errorFor };

  return (
    <section className="intake card" aria-labelledby="intake-heading">
      <div className="row row--between">
        <h1 id="intake-heading" className="intake__h1">
          Plan a new celebration
        </h1>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <Stepper current={step} />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isReview) next();
          else if (profile) onCreate(profile);
        }}
      >
        <h2 ref={headingRef} tabIndex={-1} className="intake__step-title">
          <span className="visually-hidden">
            Step {step + 1} of {STEPS.length}:{' '}
          </span>
          {current.title}
        </h2>

        <ErrorSummary errors={errors} focusKey={attempt} />

        <div className="stack">
          <CurrentStep
            id={current.id}
            stepProps={stepProps}
            today={today}
            profile={profile}
            onEventType={(eventType) => {
              setDraft((previous) => withEventType(previous, eventType, today));
            }}
          />
        </div>

        <div className="row row--between intake__nav">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => {
              goTo(step - 1);
            }}
          >
            Back
          </Button>
          <Button type="submit" variant="primary" disabled={isReview && !profile}>
            {isReview ? 'Create my plan' : 'Continue'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((item, index) => (
        <li
          key={item.id}
          className="stepper__item"
          aria-current={index === current ? 'step' : undefined}
          data-done={index < current || undefined}
        >
          <span className="stepper__num" aria-hidden="true">
            {index + 1}
          </span>
          <span className="stepper__label">{item.title}</span>
        </li>
      ))}
    </ol>
  );
}

interface CurrentStepProps {
  id: StepId;
  stepProps: StepProps;
  today: IsoDate;
  profile: EventProfile | null;
  onEventType: (eventType: EventType) => void;
}

function CurrentStep({ id, stepProps, today, profile, onEventType }: CurrentStepProps) {
  switch (id) {
    case 'occasion':
      return <OccasionStep {...stepProps} today={today} onEventType={onEventType} />;
    case 'size':
      return <SizeStep {...stepProps} />;
    case 'priorities':
      return <PrioritiesStep {...stepProps} />;
    case 'people':
      return <PeopleStep {...stepProps} />;
    case 'review':
      return <ReviewStep profile={profile} />;
  }
}
