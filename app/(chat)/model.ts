import { cookies } from "next/headers";
import { defaultModel, listModels } from "@/lib/models";
import { defaultReasoning, isReasoning, type Reasoning } from "@/lib/reasoning";

/** The model picked last, remembered in a cookie by the model picker. */
export async function selectedModel(): Promise<string> {
  const [cookieStore, models] = await Promise.all([cookies(), listModels()]);
  const id = cookieStore.get("model")?.value;
  return id && models.some((model) => model.id === id) ? id : defaultModel;
}

/** The thinking effort picked last, remembered in a cookie by its picker. */
export async function selectedReasoning(): Promise<Reasoning> {
  const reasoning = (await cookies()).get("reasoning")?.value;
  return isReasoning(reasoning) ? reasoning : defaultReasoning;
}
