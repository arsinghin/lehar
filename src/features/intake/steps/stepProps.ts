import type { IntakeDraft } from '../intakeDraft';

/** What every editable intake step receives from the wizard. */
export interface StepProps {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  errorFor: (fieldId: string) => string | undefined;
}
