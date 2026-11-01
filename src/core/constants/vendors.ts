/** Vendor checklists: what to confirm and what to ask. These are generic questions, never vendor names or prices. */
import type { Category } from './enums.js';

export interface VendorProfile {
  category: Category;
  /** Used in "Find … near <city>" Google Maps searches. */
  mapsQuery: string;
  /** Items a complete quote should state explicitly. */
  inclusions: readonly string[];
  questions: readonly string[];
}

export const VENDOR_PROFILES: Partial<Record<Category, VendorProfile>> = {
  venue: {
    category: 'venue',
    mapsQuery: 'banquet halls',
    inclusions: [
      'GST / taxes',
      'Power backup',
      'Parking',
      'Cleaning',
      'Rooms for family',
      'Outside decor allowed',
    ],
    questions: [
      'Is the date available, and how long will you hold it without an advance?',
      'What is the seated and the standing capacity of the space we would use?',
      'What are the cut-off time and the sound limits?',
      'Is there step-free access and an accessible toilet?',
      'What is the cancellation and refund policy for the advance?',
    ],
  },
  catering: {
    category: 'catering',
    mapsQuery: 'caterers',
    inclusions: [
      'GST / taxes',
      'Service staff',
      'Crockery & cutlery',
      'Live counters',
      'Tasting session',
      'Transport',
    ],
    questions: [
      'What is the per-plate price for each menu, and is GST included?',
      'What is the minimum guarantee, and what do extra plates cost on the day?',
      'Can you serve Jain, vegan or allergy-safe food separately?',
      'Is a tasting session included before we confirm?',
      'How many service staff come per 100 guests?',
    ],
  },
  decor: {
    category: 'decor',
    mapsQuery: 'event decorators',
    inclusions: ['Setup & teardown', 'Flowers', 'Lighting', 'Stage', 'Transport'],
    questions: [
      'Can you share photos of setups you have done at this venue or a similar one?',
      'Which items are fresh flowers and which are artificial or reused?',
      'How long do setup and teardown take, and what time do you need access?',
      'What changes are possible if the budget is reduced?',
      'Are lighting and the power load included?',
    ],
  },
  photo: {
    category: 'photo',
    mapsQuery: 'event photographers',
    inclusions: [
      'Videography',
      'Edited album',
      'All raw photos',
      'Drone',
      'Delivery within 30 days',
      'Travel',
    ],
    questions: [
      'How many photographers and videographers will cover each function?',
      'When will we receive the edited photos, the video and the album?',
      'Do we get all raw photos, and in what format?',
      'Are travel and stay charges included?',
      'Who owns the photos, and can you post them publicly without asking?',
    ],
  },
  entertainment: {
    category: 'entertainment',
    mapsQuery: 'DJ and live music',
    inclusions: ['Sound system', 'Performer travel', 'Setup time', 'Overtime rate'],
    questions: [
      'What is included: sound, lights, MC?',
      'What is the overtime rate per hour?',
      'Can you keep the volume suitable for elders and children?',
      'Can we share a playlist or song list in advance?',
    ],
  },
  logistics: {
    category: 'logistics',
    mapsQuery: 'sound and stage rental',
    inclusions: ['Permits', 'Sound & stage', 'Security', 'First aid', 'Generator'],
    questions: [
      'Do you handle permissions, or do we apply ourselves?',
      'What backup do you have if the power fails?',
      'How many crew members will be on site?',
      'What safety equipment do you bring?',
    ],
  },
};

/** Asked of any vendor whose category has no checklist of its own. */
export const GENERIC_VENDOR_QUESTIONS: readonly string[] = [
  'What exactly is included in the price, and what costs extra?',
  'What advance is needed, and what is the cancellation policy?',
  'What do you need from us, and by when?',
];
