/**
 * Client-safe copies of the suggested prompts.
 *
 * `lib/ask.ts` is server-only (it imports the seed loader), and importing it from a client
 * component would drag the whole transcript loader into the browser bundle.
 */
export const SUGGESTED_SINGLE = [
  "What was decided?",
  "What might fall through the cracks?",
  "Summarise this call in three lines",
];

export const SUGGESTED_ALL = [
  "What keeps coming up across these meetings?",
  "What was mentioned as urgent?",
  "What is still unresolved?",
];
