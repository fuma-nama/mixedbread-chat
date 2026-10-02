"use client";

import { Combobox } from "@base-ui/react/combobox";
import { cn } from "cn";
import { useAtom } from "jotai";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { memo, useState } from "react";
import {
  field,
  fieldInput,
  indicator,
  pill,
  popup,
} from "@/components/ui/popup";
import type { Model } from "@/lib/models";
import { remember } from "@/lib/remember";
import { modelAtom, useModels } from "./picks";

// A type, not an interface, so it fits Base UI's indexed `Group`.
type ProviderGroup = { provider: string; items: Model[] };

function groupsOf(models: Model[]) {
  const groups: ProviderGroup[] = [];
  for (const model of models) {
    const last = groups.at(-1);
    if (last?.provider === model.provider) last.items.push(model);
    else groups.push({ provider: model.provider, items: [model] });
  }
  return groups;
}

export function ModelPicker() {
  const models = useModels();
  const [model, setModel] = useAtom(modelAtom);
  const { contains } = Combobox.useFilter();
  const [query, setQuery] = useState("");
  const groups = groupsOf(models);
  // Grouped data needs the item type spelled out, or it is inferred as the group.
  const items = Combobox.createItems<Model, string>(groups, {
    getValue: (model) => model.id,
    getLabel: (model) => model.name,
  });
  const text = query.trim();

  return (
    <Combobox.Root
      items={items}
      // Each word may match the name or the provider, as in "openai sol".
      filter={(model: Model, words) => {
        const label = `${model.name} ${model.provider}`;
        return words.split(/\s+/).every((word) => contains(label, word));
      }}
      inputValue={query}
      // After a pick, the results stay while the popup fades; the next open starts blank.
      onInputValueChange={(next, { reason }) => {
        if (reason !== "input-clear") setQuery(next);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setQuery("");
      }}
      value={model}
      onValueChange={(id) => {
        if (!id) return;
        remember("model", id);
        setModel(id);
      }}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label="Model"
        className={cn(pill, "flex h-8 min-w-0 items-center gap-1 px-2")}
      >
        <span className="truncate">
          <Combobox.Value />
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          className="isolate z-50 outline-none"
          align="start"
          side="top"
          sideOffset={8}
        >
          <Combobox.Popup
            aria-label="Choose a model"
            className={cn(
              popup,
              "flex max-h-[min(22rem,var(--available-height))] w-72 max-w-(--available-width) flex-col overflow-hidden",
            )}
          >
            <div className={field}>
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <Combobox.Input
                placeholder="Search models"
                aria-label="Search models"
                className={fieldInput}
              />
            </div>
            <Combobox.Empty className="px-3 py-6 text-center text-[13px] text-muted-foreground empty:p-0">
              {text ? `No models match “${text}”` : "No models"}
            </Combobox.Empty>
            <Combobox.List
              aria-label="Models"
              className="min-h-0 flex-1 scroll-py-1 scroll-pt-8 scrollbar-thin overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0"
            >
              {(group: ProviderGroup) => (
                <Combobox.Group key={group.provider} items={group.items}>
                  <Combobox.GroupLabel className="sticky top-0 z-1 -mx-1 bg-popover px-3 pt-1.5 pb-1 font-mono text-[11px] text-muted-foreground">
                    {group.provider}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(model: Model) => (
                      <ModelItem key={model.id} model={model} />
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/** Memoized, so a broad search re-renders only the rows that come and go. */
const ModelItem = memo(function ModelItem({ model }: { model: Model }) {
  return (
    <Combobox.Item
      value={model.id}
      className="relative flex min-h-8 cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 pr-8 text-[13.5px] text-foreground/90 transition-colors duration-100 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-soft data-highlighted:text-foreground"
    >
      <span className="min-w-0 flex-1 truncate">{model.name}</span>
      <Combobox.ItemIndicator className={indicator}>
        <CheckIcon className="size-3.5 text-foreground" />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  );
});
