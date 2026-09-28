import { cookies } from "next/headers";
import { defaultModel, isModelId, type ModelId } from "@/lib/models";

/** The model picked last, remembered in a cookie by the model picker. */
export async function selectedModel(): Promise<ModelId> {
  const model = (await cookies()).get("model")?.value;
  return isModelId(model) ? model : defaultModel;
}
