"use client";

import { createContext, use, useState } from "react";
import type { Model } from "@/lib/models";
import type { Reasoning } from "@/lib/reasoning";

interface Models {
  models: Model[];
  /** The model and effort for the next question, kept across chats. */
  model: string;
  setModel: (model: string) => void;
  reasoning: Reasoning;
  setReasoning: (reasoning: Reasoning) => void;
}

const ModelsContext = createContext<Models | null>(null);

export function ModelsProvider({
  models,
  model: initialModel,
  reasoning: initialReasoning,
  children,
}: {
  models: Model[];
  model: string;
  reasoning: Reasoning;
  children: React.ReactNode;
}) {
  const [model, setModel] = useState(initialModel);
  const [reasoning, setReasoning] = useState(initialReasoning);

  return (
    <ModelsContext value={{ models, model, setModel, reasoning, setReasoning }}>
      {children}
    </ModelsContext>
  );
}

export function useModels(): Models {
  const models = use(ModelsContext);
  if (!models) throw new Error("useModels needs a <ModelsProvider>");
  return models;
}
