import { useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { ErrorSummary, type FieldError } from '../../components/ErrorSummary';
import type { EventProfile } from '../../core/schemas';
import {
  draftToProfile,
  initialDraft,
  STEPS,
  validateStep,
  withEventType,
  type IntakeDraft,
  type StepIndex,
} from './intakeDraft';
import { OccasionStep, PeopleStep, PrioritiesStep, ReviewStep, SizeStep } from './IntakeSteps';

interface Props {
  today: string;
  onCreate: (profile: EventProfile) => void;
  onCancel: () => void;
}

export function IntakeWizard({ today, onCreate, onCancel }: Props) {
  const [draft, setDraft] = useState<IntakeDraft>(() => initialDraft(today));
  const [step, setStep] = useState<StepIndex>(0);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const update = (patch: Partial<IntakeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;

  const goTo = (next: StepIndex) => {
    setErrors([]);
    setStep(next);
    // Move focus to the new step heading so keyboard and screen-reader users know where they are.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    const stepErrors = validateStep(step, draft, today);
    setErrors(stepErrors);
    setAttempt((count) => count + 1);
    if (stepErrors.length === 0 && step < 4) goTo((step + 1) as StepIndex);
  };

  const profile = step === 4 ? draftToProfile(draft, today) : null;
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

      <ol className="stepper" aria-label="Progress">
        {STEPS.map((item, index) => (
          <li
            key={item.id}
            className="stepper__item"
            aria-current={index === step ? 'step' : undefined}
            data-done={index < step || undefined}
          >
            <span className="stepper__num" aria-hidden="true">
              {index + 1}
            </span>
            <span className="stepper__label">{item.title}</span>
          </li>
        ))}
      </ol>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 4) next();
          else if (profile) onCreate(profile);
        }}
      >
        <h2 ref={headingRef} tabIndex={-1} className="intake__step-title">
          <span className="visually-hidden">
            Step {step + 1} of {STEPS.length}:{' '}
          </span>
          {STEPS[step].title}
        </h2>

        <ErrorSummary errors={errors} focusKey={attempt} />

        <div className="stack">
          {step === 0 ? (
            <OccasionStep
              {...stepProps}
              today={today}
              onEventType={(eventType) => {
                setDraft((current) => withEventType(current, eventType, today));
              }}
            />
          ) : null}
          {step === 1 ? <SizeStep {...stepProps} /> : null}
          {step === 2 ? <PrioritiesStep {...stepProps} /> : null}
          {step === 3 ? <PeopleStep {...stepProps} /> : null}
          {step === 4 ? <ReviewStep profile={profile} /> : null}
        </div>

        <div className="row row--between intake__nav">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => {
              goTo((step - 1) as StepIndex);
            }}
          >
            Back
          </Button>
          <Button type="submit" variant="primary" disabled={step === 4 && !profile}>
            {step === 4 ? 'Create my plan' : 'Continue'}
          </Button>
        </div>
      </form>
    </section>
  );
}
