import { useState } from 'react';

import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { TextField } from '../../components/Field';
import { LIMITS } from '../../core/constants/limits';
import { REFINEMENTS } from './ideaLabels';

/** Shorter text cannot describe a refinement. */
const MIN_REFINE_TEXT = 2;

export interface RefineControlsProps {
  ideaTitle: string;
  /** True while this idea is being refined. */
  busy: boolean;
  /** True while any AI request on this screen is running. */
  disabled: boolean;
  onRefine: (instruction: string) => void;
}

/** One-click refinements plus "say what to change" for a single idea. */
export function RefineControls({ ideaTitle, busy, disabled, onRefine }: RefineControlsProps) {
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | undefined>();

  return (
    <fieldset className="refine">
      <legend className="small">Refine “{ideaTitle}”</legend>
      <div className="row">
        {REFINEMENTS.map((item) => (
          <Chip
            key={item.label}
            disabled={disabled}
            onClick={() => {
              onRefine(item.instruction);
            }}
          >
            {item.label}
          </Chip>
        ))}
      </div>
      <form
        className="row refine__custom"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const text = custom.trim();
          if (text.length < MIN_REFINE_TEXT) {
            setError('Describe what you would like to change.');
            return;
          }
          setError(undefined);
          onRefine(text);
        }}
      >
        <TextField
          label="Or say what to change"
          hideLabel
          placeholder="For example: we have no stage, keep it outdoors"
          maxLength={LIMITS.maxRefineText}
          value={custom}
          error={error}
          onChange={(event) => {
            setCustom(event.target.value);
          }}
        />
        <Button
          aria-label={`Refine ${ideaTitle}`}
          type="submit"
          size="s"
          busy={busy}
          disabled={disabled}
        >
          Refine
        </Button>
      </form>
    </fieldset>
  );
}
