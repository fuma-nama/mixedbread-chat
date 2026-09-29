"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { cn } from "cn";
import { CheckIcon, SearchIcon } from "lucide-react";

const Combobox = ComboboxPrimitive.Root;

const ComboboxValue = ComboboxPrimitive.Value;

const ComboboxCollection = ComboboxPrimitive.Collection;

/** Items whose selection value is an id, while the list still renders the objects. */
const createComboboxItems = ComboboxPrimitive.createItems;

const useComboboxFilter = ComboboxPrimitive.useFilter;

function ComboboxTrigger({ ...props }: ComboboxPrimitive.Trigger.Props) {
  return <ComboboxPrimitive.Trigger data-slot="combobox-trigger" {...props} />;
}

/**
 * A popup with its own search field, for a searchable select. Opening
 * upward it keeps its height while filtering, so the search field at its
 * top stays put instead of sliding down as results shrink.
 */
function ComboboxContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 6,
  className,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "flex max-h-[min(22rem,var(--available-height))] w-72 max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-float transition-[opacity,scale] duration-150 ease-smooth outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-[side=top]:h-[min(22rem,var(--available-height))] motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

/** A quiet search row across the top of the popup, like the ⌘K palette's. */
function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <div
      data-slot="combobox-input-wrapper"
      className="flex h-10 shrink-0 items-center gap-2 border-b border-soft px-3"
    >
      <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(
          "h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/75 md:text-[13.5px]",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** Shown in place of the list when nothing matches. */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "flex items-center justify-center px-3 py-6 text-center text-[13px] text-muted-foreground not-empty:flex-1 empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "min-h-0 flex-1 scroll-py-1 scrollbar-thin overflow-y-auto overscroll-contain p-1 outline-none data-empty:flex-none data-empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxGroup({ ...props }: ComboboxPrimitive.Group.Props) {
  return <ComboboxPrimitive.Group data-slot="combobox-group" {...props} />;
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn(
        "px-2 pt-1.5 pb-1 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "group/combobox-item relative flex min-h-8 cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 pr-8 text-[13.5px] text-foreground/90 transition-colors duration-100 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-soft data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-highlighted:[&_svg:not([class*='text-'])]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex transition-[opacity,scale] duration-150 ease-spring data-ending-style:scale-50 data-ending-style:opacity-0 data-starting-style:scale-50 data-starting-style:opacity-0 motion-reduce:transition-none">
        <CheckIcon className="size-3.5 text-foreground!" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

export {
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
};
