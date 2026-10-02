import type { SearchScope } from "./sources";

const suggestions: Record<SearchScope, string[]> = {
  web: [
    "What's new in the latest Next.js?",
    "How does late interaction work?",
    "Summarize this week's AI news",
  ],
  docs: [
    "What can my documents answer?",
    "Summarize my documents",
    "Which documents mention deadlines?",
  ],
  both: [
    "What can my documents answer?",
    "Summarize my documents",
    "Summarize this week's AI news",
  ],
  none: [
    "Explain late interaction retrieval",
    "Write a haiku about sourdough",
    "How do embeddings work?",
  ],
};

/** Longer names crowd the pills, and a question is sent just as it reads. */
const MAX_NAME = 24;

export function suggestionsFor(
  scope: SearchScope,
  picked: { name: string }[],
): string[] {
  const base = suggestions[scope];
  if (picked.length === 0 || picked.length > 2) return base;
  if (picked.some((store) => store.name.length > MAX_NAME)) return base;
  const [a, b] = picked;
  const named = b
    ? [
        `What do ${a.name} and ${b.name} cover?`,
        `Compare ${a.name} and ${b.name}`,
      ]
    : [`What does ${a.name} cover?`, `Summarize the key points in ${a.name}`];
  return [...named, base[2]];
}
