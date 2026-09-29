import type { SearchScope } from "./search-tool";

/** Questions the empty state offers, true to what the configured stores can answer. */
export const suggestions: Record<SearchScope, string[]> = {
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
};
