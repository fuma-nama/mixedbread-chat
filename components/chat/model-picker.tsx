"use client";

import { ChevronDownIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
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
import type { Model } from "@/lib/models";
import { useModels } from "./models-provider";

// A type, not an interface, so it fits Base UI's indexed `Group`.
type ProviderGroup = { provider: string; items: Model[] };

const MORE = "More models";

/** Featured models by provider, and the rest of the catalog in one group. */
function groupsOf(models: Model[]) {
  const featured: ProviderGroup[] = [];
  const more: Model[] = [];
  for (const model of models) {
    const last = featured.at(-1);
    if (!model.featured) more.push(model);
    else if (last?.provider === model.provider) last.items.push(model);
    else featured.push({ provider: model.provider, items: [model] });
  }
  const all =
    more.length > 0 ? [...featured, { provider: MORE, items: more }] : featured;
  return { featured, more, all };
}

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
  const catalog = useMemo(() => {
    const groups = groupsOf(models);
    // Grouped data needs the item type spelled out, or it is inferred as the group.
    const items = createComboboxItems<Model, string>(groups.all, {
      getValue: (model) => model.id,
      getLabel: (model) => model.name,
    });
    return { ...groups, items };
  }, [models]);
  const text = query.trim();

  // The featured models, plus the one picked if it isn't among them, until a
  // search reaches the whole catalog. Each word matches the name or the
  // provider, so "claude 5.5" and "openai sol" both find what they mean.
  const shown = useMemo(() => {
    if (!text) {
      const picked = catalog.more.find((model) => model.id === value);
      return picked
        ? [...catalog.featured, { provider: MORE, items: [picked] }]
        : catalog.featured;
    }
    const words = text.split(/\s+/);
    const found: ProviderGroup[] = [];
    for (const group of catalog.all) {
      const items: Model[] = [];
      for (const model of group.items) {
        if (words.every((word) => contains(model, word, searchText))) {
          items.push(model);
        }
      }
      if (items.length > 0) found.push({ provider: group.provider, items });
    }
    return found;
  }, [catalog, text, value, contains]);

  return (
    <Combobox
      items={catalog.items}
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
      <ComboboxContent side="top" sideOffset={8} aria-label="Choose a model">
        <ComboboxInput
          placeholder={
            models.length > 0
              ? `Search ${models.length} models`
              : "Search models"
          }
          aria-label="Search models"
        />
        <ComboboxEmpty>
          {text ? `No models match “${text}”` : "No models"}
        </ComboboxEmpty>
        <ComboboxList aria-label="Models" className="scroll-pt-8">
          {(group: ProviderGroup) => (
            <ComboboxGroup key={group.provider} items={group.items}>
              <ComboboxLabel className="sticky top-0 z-1 -mx-1 bg-popover px-3">
                {group.provider}
              </ComboboxLabel>
              <ComboboxCollection>
                {(model: Model) => <ModelItem key={model.id} model={model} />}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
});

/** Memoized, so a broad search re-renders only the rows that come and go. */
const ModelItem = memo(function ModelItem({ model }: { model: Model }) {
  return (
    <ComboboxItem value={model.id}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{model.name}</span>
        {model.toast && (
          <span className="text-xs text-muted-foreground">
            Answers straight from your sources
          </span>
        )}
      </span>
      {/* Outside the featured groups, the provider says whose model it is. */}
      {!model.featured && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground/80">
          {model.provider}
        </span>
      )}
    </ComboboxItem>
  );
});
