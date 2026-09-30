"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "cn";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

/** Grows to its content's height when opened, and folds back when closed. */
function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        "flow-root h-(--collapsible-panel-height) overflow-y-clip transition-[height,opacity] duration-300 ease-smooth data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none [&[hidden]:not([hidden=until-found])]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
