"use client";

import { ChevronDownIcon } from "lucide-react";
import { memo } from "react";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  createComboboxItems,
  useComboboxFilter,
} from "@/components/ui/combobox";
import { isModelId, type ModelId, models } from "@/lib/models";

type Model = (typeof models)[number];

interface ProviderGroup {
  provider: string;
  items: Model[];
}

/** The catalog grouped by provider, in the order it lists them. */
const groups: ProviderGroup[] = [];
for (const model of models) {
  const group = groups.find((entry) => entry.provider === model.provider);
  if (group) group.items.push(model);
  else groups.push({ provider: model.provider, items: [model] });
}

// Grouped data needs the item type spelled out, or it is inferred as the group.
const items = createComboboxItems<Model, ModelId>(groups, {
  getValue: (model) => model.id,
  getLabel: (model) => model.name,
});

function searchText(model: Model) {
  return `${model.name} ${model.provider}`;
}

/** Picks the chat model; the choice is kept for the next visit. */
export const ModelPicker = memo(function ModelPicker({
  value,
  onChange,
}: {
  value: ModelId;
  onChange: (model: ModelId) => void;
}) {
  const { contains } = useComboboxFilter();

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(id) => {
        if (!isModelId(id)) return;
        // Read by the server to preselect the model on the next visit.
        void cookieStore.set({
          name: "model",
          value: id,
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        });
        onChange(id);
      }}
      // Each word matches the name or the provider, so "claude 5.5" and
      // "openai sol" both find what they mean.
      filter={(model: Model, query: string) =>
        query.split(/\s+/).every((word) => contains(model, word, searchText))
      }
      autoHighlight
    >
      <ComboboxTrigger
        aria-label="Model"
        // Its label starts where the text above it does: 10px of bar + 8px here.
        className="flex h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-[13px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:bg-soft hover:text-foreground focus-visible:outline-2 aria-expanded:bg-soft aria-expanded:text-foreground"
      >
        <ComboboxValue />
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </ComboboxTrigger>
      <ComboboxContent side="top" sideOffset={8} aria-label="Choose a model">
        <ComboboxInput placeholder="Search models" aria-label="Search models" />
        <ComboboxEmpty>No models</ComboboxEmpty>
        <ComboboxList aria-label="Models">
          {(group: ProviderGroup) => (
            <ComboboxGroup key={group.provider} items={group.items}>
              <ComboboxLabel>{group.provider}</ComboboxLabel>
              <ComboboxCollection>
                {(model: Model) => (
                  <ComboboxItem key={model.id} value={model.id}>
                    {model.name}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
});
