"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

export const Collapsible = CollapsiblePrimitive.Root;

export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

export function CollapsibleContent(props: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      className="flow-root h-(--collapsible-panel-height) overflow-y-clip transition-[height,opacity] duration-300 ease-smooth data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none [&[hidden]:not([hidden=until-found])]:hidden"
      {...props}
    />
  );
}
