/**
 * How hard the model thinks before it answers, passed to the AI SDK as
 * `reasoning`; each provider maps it onto what its model supports. The
 * picker lists them in this order: Auto, then least effort to most.
 */
export const reasoningLevels = [
  { id: "auto", name: "Auto", description: "Up to the model" },
  { id: "low", name: "Low", description: "Quickest answers" },
  { id: "medium", name: "Medium", description: "Balanced speed and depth" },
  { id: "high", name: "High", description: "Deepest, for hard questions" },
] as const;

export type Reasoning = (typeof reasoningLevels)[number]["id"];

export const defaultReasoning: Reasoning = "auto";

export function isReasoning(value: unknown): value is Reasoning {
  return reasoningLevels.some((level) => level.id === value);
}
