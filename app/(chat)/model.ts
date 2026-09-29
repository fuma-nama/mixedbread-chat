import { cookies } from "next/headers";
import { defaultModel, isModelId, type ModelId } from "@/lib/models";
import { defaultReasoning, isReasoning, type Reasoning } from "@/lib/reasoning";
import {
  defaultSelection,
  parseSelection,
  SELECTION_COOKIE,
  type SourceSelection,
} from "@/lib/sources";

/** The sources picked last, remembered in a cookie by their picker. */
export async function selectedSources(): Promise<SourceSelection> {
  const value = (await cookies()).get(SELECTION_COOKIE)?.value;
  return parseSelection(value) ?? defaultSelection;
}

/** The model picked last, remembered in a cookie by the model picker. */
export async function selectedModel(): Promise<ModelId> {
  const model = (await cookies()).get("model")?.value;
  return isModelId(model) ? model : defaultModel;
}

/** The thinking effort picked last, remembered in a cookie by its picker. */
export async function selectedReasoning(): Promise<Reasoning> {
  const reasoning = (await cookies()).get("reasoning")?.value;
  return isReasoning(reasoning) ? reasoning : defaultReasoning;
}
