import type { Tone } from '../../components/Badge';
import type { CostLevel } from '../../core/constants/enums';

/** One-click refinements: the label on the chip and the instruction sent with the idea. */
export const REFINEMENTS = [
  { label: 'Cheaper', instruction: 'Make it cheaper without losing the feel' },
  { label: 'Kid-friendly', instruction: 'Make it work well for young children' },
  { label: 'Elder-friendly', instruction: 'Make it comfortable for elderly family members' },
  { label: 'More traditional', instruction: 'Make it more traditional' },
  { label: 'Eco-friendly', instruction: 'Make it eco-friendly and low-waste' },
] as const;

export const COST_TEXT: Record<CostLevel, string> = {
  lower: 'Lower cost',
  similar: 'Similar cost',
  higher: 'Higher cost',
};

export const COST_TONE: Record<CostLevel, Tone> = {
  lower: 'ok',
  similar: 'neutral',
  higher: 'warn',
};
