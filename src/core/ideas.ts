/**
 * Rule-based idea generator. It is used when no AI provider is reachable, so the app always works.
 * It picks from a small curated library by matching the guests' ages, culture, style and any
 * refinement, then fills in food lines for the host's diets. Output matches the AI's Idea shape.
 */
import {
  DIET_LABELS,
  type AgeGroup,
  type Diet,
  type EventType,
  type Tier,
} from './constants/enums.js';
import type { Idea } from './schemas.js';

type Tag = 'kids' | 'seniors' | 'traditional' | 'eco' | 'budget' | 'grand' | 'intimate';

interface IdeaTemplate {
  title: string;
  summary: string;
  decor: string;
  activity: string;
  tags: readonly Tag[];
}

const LIBRARY: Record<EventType, readonly IdeaTemplate[]> = {
  wedding: [
    {
      title: 'Marigold courtyard',
      summary:
        'A warm, traditional setup built around marigold strings and diyas, so the space feels festive without heavy stage work.',
      decor: 'Marigold and mango-leaf torans, brass diyas, cotton drapes in two colours.',
      activity: 'A family antakshari corner during the sangeet.',
      tags: ['traditional', 'budget', 'seniors'],
    },
    {
      title: 'Garden pastel evening',
      summary: 'Soft pastels, fairy lights and open seating clusters, so guests can actually talk.',
      decor: 'Pastel florals on reused frames, warm fairy lights, low lounge seating.',
      activity: 'A photo wall with family wedding photos from past generations.',
      tags: ['intimate', 'eco', 'seniors'],
    },
    {
      title: 'Heritage minimal',
      summary:
        'A few strong elements done well: a statement mandap, good lighting and calm colours.',
      decor: 'A wooden mandap with jasmine strings, handloom table runners.',
      activity: 'A live folk musician during dinner instead of a loud DJ.',
      tags: ['traditional', 'intimate', 'grand'],
    },
    {
      title: 'Kids’ corner wedding',
      summary:
        'A family-first plan with a supervised kids’ zone, so parents can enjoy the functions.',
      decor: 'Colourful paper lanterns and a separate low-height kids’ area.',
      activity: 'Mehendi and craft table for children with one helper.',
      tags: ['kids', 'budget'],
    },
  ],
  birthday: [
    {
      title: 'Jungle explorer',
      summary: 'A safari trail through the party space with small missions at each stop.',
      decor: 'Green streamers, paper leaves, animal cut-outs made with the kids.',
      activity: 'Treasure hunt with picture clues for non-readers.',
      tags: ['kids', 'budget', 'eco'],
    },
    {
      title: 'Little scientists lab',
      summary: 'Safe, messy experiments that kids take home as return gifts.',
      decor: 'Lab-coat aprons, bubble lights, a “lab” banner.',
      activity: 'Volcano and slime stations run by two adults.',
      tags: ['kids'],
    },
    {
      title: 'Retro Bollywood night',
      summary: 'Old songs, filmy dress-up and a dance-off across generations.',
      decor: 'Vintage posters, string lights, a vinyl-style photo frame.',
      activity: 'Antakshari and dance-off with family teams.',
      tags: ['seniors', 'grand'],
    },
    {
      title: 'Garden brunch',
      summary: 'A relaxed daytime gathering focused on food and conversation.',
      decor: 'Potted plants, cotton tablecloths, handwritten name cards.',
      activity: 'A memory jar where guests write a wish.',
      tags: ['intimate', 'eco', 'budget', 'seniors'],
    },
  ],
  community: [
    {
      title: 'Eco Diwali mela',
      summary: 'A plastic-free mela with reusable decor and stalls run by residents.',
      decor: 'Clay diyas, rangoli with natural colours, cloth bunting.',
      activity: 'Rangoli competition by age group and a no-firecracker light walk.',
      tags: ['eco', 'budget', 'kids', 'traditional'],
    },
    {
      title: 'Cultural potluck evening',
      summary:
        'Every wing brings a dish and a performance, so it is cheap and everyone takes part.',
      decor: 'Wing-wise colour themes and a simple shared stage.',
      activity: 'Short performances by each wing, plus a kids’ talent slot.',
      tags: ['budget', 'kids', 'seniors'],
    },
    {
      title: 'Lantern walk and music',
      summary: 'A gentle evening walk with lanterns, ending in live music near the clubhouse.',
      decor: 'Paper lanterns made in a kids’ workshop the week before.',
      activity: 'Lantern-making workshop and an acoustic set.',
      tags: ['eco', 'kids', 'seniors', 'intimate'],
    },
    {
      title: 'Grand stage night',
      summary: 'A big-stage evening with a hired act and well-lit food stalls.',
      decor: 'A stage backdrop, LED wash lights, stall signage.',
      activity: 'Main performance with a seated area for elders up front.',
      tags: ['grand', 'seniors'],
    },
  ],
};

export interface IdeaRequestContext {
  eventType: EventType;
  guests: number;
  tier: Tier;
  ageGroups: readonly AgeGroup[];
  diets: readonly Diet[];
  culture: string;
  mustHaves: readonly string[];
}

const REFINE_TAGS: [RegExp, Tag][] = [
  [/cheap|budget|afford|less money|lower cost|simple/i, 'budget'],
  [/kid|child|children/i, 'kids'],
  [/elder|senior|grand(?:parent|ma|pa)|old/i, 'seniors'],
  [/tradition|cultur|classic|ethnic/i, 'traditional'],
  [/eco|green|sustain|plastic/i, 'eco'],
  [/grand|big|lavish|premium/i, 'grand'],
  [/small|intimate|quiet|cosy|cozy/i, 'intimate'],
];

function wantedTags(context: IdeaRequestContext, refine: string | undefined): Map<Tag, number> {
  const weights = new Map<Tag, number>();
  const add = (tag: Tag, weight: number) => weights.set(tag, (weights.get(tag) ?? 0) + weight);
  if (context.ageGroups.includes('kids')) add('kids', 2);
  if (context.ageGroups.includes('seniors')) add('seniors', 1);
  if (context.culture.trim()) add('traditional', 1);
  if (context.tier === 'simple') add('budget', 2);
  if (context.tier === 'premium') add('grand', 2);
  if (context.guests <= 40) add('intimate', 1);
  for (const [pattern, tag] of REFINE_TAGS) if (refine && pattern.test(refine)) add(tag, 4);
  return weights;
}

function foodLine(diets: readonly Diet[], kids: boolean): string {
  const menu =
    diets.length > 0 ? diets.map((diet) => DIET_LABELS[diet]).join(' and ') : 'A simple shared';
  return `${menu} menu with labelled counters${kids ? ', plus a mild kids’ plate' : ''}.`;
}

function whyItFits(context: IdeaRequestContext, template: IdeaTemplate): string {
  const reasons = [`works for about ${context.guests} guests`];
  if (template.tags.includes('kids') && context.ageGroups.includes('kids'))
    reasons.push('keeps children busy');
  if (template.tags.includes('seniors') && context.ageGroups.includes('seniors'))
    reasons.push('is comfortable for elders');
  if (template.tags.includes('budget')) reasons.push('spends little on decor');
  if (context.mustHaves[0]) reasons.push(`leaves room for “${context.mustHaves[0]}”`);
  return `It ${reasons.join(', ')}.`;
}

/** Three ideas ranked by fit. Deterministic for the same input. */
export function generateFallbackIdeas(context: IdeaRequestContext, refine?: string): Idea[] {
  const weights = wantedTags(context, refine);
  const score = (template: IdeaTemplate) =>
    template.tags.reduce((sum, tag) => sum + (weights.get(tag) ?? 0), 0);
  const cheaper = refine !== undefined && /cheap|budget|afford|less money|lower cost/i.test(refine);
  return [...LIBRARY[context.eventType]]
    .map((template, index) => ({ template, index, score: score(template) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ template }) => ({
      title: template.title,
      summary: template.summary,
      decor: template.decor,
      food: foodLine(context.diets, context.ageGroups.includes('kids')),
      activity: template.activity,
      whyItFits: whyItFits(context, template),
      costLevel:
        cheaper || template.tags.includes('budget')
          ? 'lower'
          : template.tags.includes('grand')
            ? 'higher'
            : 'similar',
    }));
}
