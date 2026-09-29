/**
 * How hard the model thinks before it answers. Auto leaves it to the
 * provider; the rest are the AI SDK's `reasoning` values, least effort to
 * most, and each model takes the ones AI Gateway lists for it.
 */
export const reasoningLevels = [
  { id: "auto", name: "Auto", description: "Up to the model" },
  { id: "none", name: "Off", description: "Answers right away" },
  { id: "minimal", name: "Minimal", description: "A moment’s thought" },
  { id: "low", name: "Low", description: "Thinks briefly" },
  { id: "medium", name: "Medium", description: "Balanced speed and depth" },
  { id: "high", name: "High", description: "For hard questions" },
  { id: "xhigh", name: "Extra high", description: "Deepest and slowest" },
] as const;

export type Reasoning = (typeof reasoningLevels)[number]["id"];

export type Effort = Exclude<Reasoning, "auto">;

export const defaultReasoning: Reasoning = "auto";

export function isReasoning(value: unknown): value is Reasoning {
  return reasoningLevels.some((level) => level.id === value);
}
