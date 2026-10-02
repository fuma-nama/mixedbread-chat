// Auto leaves it to the provider; the rest are AI SDK `reasoning` values, least to most.
export const reasoningLevels = [
  { id: "auto", name: "Auto" },
  { id: "none", name: "Off" },
  { id: "minimal", name: "Minimal" },
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
  { id: "xhigh", name: "Extra high" },
] as const;

export type Reasoning = (typeof reasoningLevels)[number]["id"];

export type Effort = Exclude<Reasoning, "auto">;

export function isReasoning(value: unknown): value is Reasoning {
  return reasoningLevels.some((level) => level.id === value);
}
