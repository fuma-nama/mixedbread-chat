"use client";

import { ChevronDownIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  createComboboxItems,
  useComboboxFilter,
} from "@/components/ui/combobox";
import type { Model } from "@/lib/models";
import { useModels } from "./models-provider";

function searchText(model: Model) {
  return `${model.name} ${model.provider}`;
}

/** Picks the chat model; the choice is kept for the next visit. */
export const ModelPicker = memo(function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}) {
  const models = useModels();
  const { contains } = useComboboxFilter();
  const [query, setQuery] = useState("");
  const items = useMemo(
    () =>
      createComboboxItems(models, {
        getValue: (model) => model.id,
        getLabel: (model) => model.name,
      }),
    [models],
  );
  const text = query.trim();

  // The featured models, and the one picked if it isn't among them, until a
  // search reaches the whole catalog. Each word matches the name or the
  // provider, so "claude 5.5" and "openai sol" both find what they mean.
  const shown = useMemo(() => {
    const words = text.split(/\s+/);
    const found: Model[] = [];
    for (const model of models) {
      if (
        text
          ? words.every((word) => contains(model, word, searchText))
          : model.featured || model.id === value
      ) {
        found.push(model);
      }
    }
    return found;
  }, [models, text, value, contains]);

  return (
    <Combobox
      items={items}
      filteredItems={shown}
      inputValue={query}
      // A pick clears the field at once; the results it found stay while the
      // popup fades, and the next open starts blank.
      onInputValueChange={(next, { reason }) => {
        if (reason !== "input-clear") setQuery(next);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setQuery("");
      }}
      value={value}
      onValueChange={(id) => {
        if (!id) return;
        // Read by the server to preselect the model on the next visit.
        void cookieStore.set({
          name: "model",
          value: id,
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        });
        onChange(id);
      }}
      autoHighlight
    >
      <ComboboxTrigger
        aria-label="Model"
        // Its label starts where the text above it does: 10px of bar + 8px here.
        className="flex h-8 min-w-0 cursor-pointer items-center gap-1 rounded-full px-2 text-[13px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:bg-soft hover:text-foreground focus-visible:outline-2 aria-expanded:bg-soft aria-expanded:text-foreground"
      >
        <span className="truncate">
          <ComboboxValue />
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
      </ComboboxTrigger>
      <ComboboxContent side="top" sideOffset={8} aria-label="Models">
        <ComboboxInput placeholder="Search" aria-label="Search models" />
        <ComboboxEmpty>No models</ComboboxEmpty>
        <ComboboxList aria-label="Models">
          {(model: Model) => <ModelItem key={model.id} model={model} />}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
});

/** Memoized, so a broad search re-renders only the rows that come and go. */
const ModelItem = memo(function ModelItem({ model }: { model: Model }) {
  return (
    <ComboboxItem value={model.id}>
      <span className="truncate">{model.name}</span>
    </ComboboxItem>
  );
});
