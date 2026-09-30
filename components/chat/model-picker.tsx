"use client";

import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { memo, useState } from "react";
import type { Model } from "@/lib/models";
import { remember } from "@/lib/remember";
import { useModels } from "./models-provider";

// A type, not an interface, so it fits Base UI's indexed `Group`.
type ProviderGroup = { provider: string; items: Model[] };

const MORE = "More models";

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

export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}) {
  const { models } = useModels();
  const { contains } = Combobox.useFilter();
  const [query, setQuery] = useState("");
  const catalog = groupsOf(models);
  // Grouped data needs the item type spelled out, or it is inferred as the group.
  const items = Combobox.createItems<Model, string>(catalog.all, {
    getValue: (model) => model.id,
    getLabel: (model) => model.name,
  });
  const text = query.trim();

  // The featured models, plus the one picked if it isn't among them, until a
  // search reaches the whole catalog. Each word matches the name or the
  // provider, so "claude 5.5" and "openai sol" both find what they mean.
  let shown: ProviderGroup[] = [];
  if (text) {
    const words = text.split(/\s+/);
    for (const group of catalog.all) {
      const found = group.items.filter((model) => {
        const label = `${model.name} ${model.provider}`;
        return words.every((word) => contains(label, word));
      });
      if (found.length > 0)
        shown.push({ provider: group.provider, items: found });
    }
  } else {
    const picked = catalog.more.find((model) => model.id === value);
    shown = picked
      ? [...catalog.featured, { provider: MORE, items: [picked] }]
      : catalog.featured;
  }

  return (
    <Combobox.Root
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
        remember("model", id);
        onChange(id);
      }}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label="Model"
        className="flex h-8 min-w-0 cursor-pointer items-center gap-1 rounded-full px-2 text-[13px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:bg-soft hover:text-foreground focus-visible:outline-2 aria-expanded:bg-soft aria-expanded:text-foreground"
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
            className="flex max-h-[min(22rem,var(--available-height))] w-72 max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-float transition-[opacity,scale] duration-150 ease-smooth outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none"
          >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-soft px-3 in-data-[side=top]:order-last in-data-[side=top]:border-t in-data-[side=top]:border-b-0">
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <Combobox.Input
                placeholder="Search models"
                aria-label="Search models"
                className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/75 md:text-[13.5px]"
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
                  <Combobox.GroupLabel className="sticky top-0 z-1 -mx-1 bg-popover px-3 pt-1.5 pb-1 text-xs text-muted-foreground">
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
      {!model.featured && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground/80">
          {model.provider}
        </span>
      )}
      <Combobox.ItemIndicator className="absolute right-2 flex transition-[opacity,scale] duration-150 ease-spring data-ending-style:scale-50 data-ending-style:opacity-0 data-starting-style:scale-50 data-starting-style:opacity-0 motion-reduce:transition-none">
        <CheckIcon className="size-3.5 text-foreground" />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  );
});
