"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import { backdropClassName } from "@/components/ui/dialog";

/** A search field over a list that stays open, as in a command palette. */
function Command(props: React.ComponentProps<typeof Autocomplete.Root>) {
  return (
    <Autocomplete.Root
      open
      inline
      autoHighlight="always"
      keepHighlight
      {...props}
    />
  );
}

/**
 * A palette that drops in from the top third of the screen. On a short
 * screen it stops short of the bottom edge, and its list scrolls instead.
 */
function CommandDialog({
  title,
  description,
  children,
  className,
  ...props
}: Omit<DialogPrimitive.Root.Props, "children"> & {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={backdropClassName} />
        <DialogPrimitive.Popup
          data-slot="command-dialog"
          className={cn(
            "fixed top-[min(18vh,10rem)] left-1/2 z-50 flex max-h-[calc(100dvh-min(18vh,10rem)-1.5rem)] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-float transition-[opacity,scale,translate] duration-200 ease-smooth outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:-translate-y-2 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CommandInput({
  className,
  children,
  ...props
}: Autocomplete.Input.Props) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-13 shrink-0 items-center gap-3 border-b border-soft px-4"
    >
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <Autocomplete.Input
        data-slot="command-input"
        className={cn(
          "h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/75",
          className,
        )}
        {...props}
      />
      {children}
    </div>
  );
}

/**
 * The items under the input, or `empty` in their place. It grows and
 * shrinks with them.
 */
function CommandList({
  empty,
  ...props
}: Autocomplete.List.Props & { empty?: React.ReactNode }) {
  return (
    <div
      data-slot="command-list"
      tabIndex={-1}
      className="h-[calc(var(--content-height)+0.75rem)] max-h-[22rem] min-h-0 scroll-fade-y scroll-py-2 scrollbar-thin overflow-y-auto overscroll-contain p-1.5 transition-[height] duration-200 ease-smooth outline-none [--scroll-fade-size:1.5rem] motion-reduce:transition-none"
    >
      <div ref={trackHeight}>
        <Autocomplete.Status className="text-center text-[13.5px] text-muted-foreground not-empty:py-10">
          {empty}
        </Autocomplete.Status>
        <Autocomplete.List className="outline-none" {...props} />
      </div>
    </div>
  );
}

/** Mirrors the content's height onto its scroller, which transitions to it. */
function trackHeight(content: HTMLDivElement) {
  const observer = new ResizeObserver(() => {
    content.parentElement?.style.setProperty(
      "--content-height",
      `${content.offsetHeight}px`,
    );
  });
  observer.observe(content);
  return () => observer.disconnect();
}

function CommandGroup({
  heading,
  children,
  ...props
}: Autocomplete.Group.Props & { heading: React.ReactNode }) {
  return (
    <Autocomplete.Group data-slot="command-group" {...props}>
      <Autocomplete.GroupLabel className="px-2.5 pt-2 pb-1.5 text-xs text-muted-foreground">
        {heading}
      </Autocomplete.GroupLabel>
      {children}
    </Autocomplete.Group>
  );
}

function CommandItem({ className, ...props }: Autocomplete.Item.Props) {
  return (
    <Autocomplete.Item
      data-slot="command-item"
      className={cn(
        "flex h-10 cursor-default items-center gap-3 rounded-lg px-2.5 text-[14px] text-foreground/85 outline-none select-none data-highlighted:bg-soft data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
};
