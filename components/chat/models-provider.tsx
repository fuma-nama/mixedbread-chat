"use client";

import { createContext, use } from "react";
import type { Model } from "@/lib/models";

const ModelsContext = createContext<Model[]>([]);

// Sent once with the layout instead of with each page.
export function ModelsProvider({
  models,
  children,
}: {
  models: Model[];
  children: React.ReactNode;
}) {
  return <ModelsContext value={models}>{children}</ModelsContext>;
}

export function useModels(): Model[] {
  return use(ModelsContext);
}
