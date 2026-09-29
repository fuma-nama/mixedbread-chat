"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "cn";

/** One card for many triggers: each passes its payload, and the card shows the active one's. */
const HoverCard = PreviewCardPrimitive.Root;

const createHoverCardHandle = PreviewCardPrimitive.createHandle;

type HoverCardHandle<Payload> = PreviewCardPrimitive.Handle<Payload>;

function HoverCardTrigger<Payload>({
  delay = 250,
  closeDelay = 150,
  ...props
}: PreviewCardPrimitive.Trigger.Props<Payload>) {
  return (
    <PreviewCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      delay={delay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

/**
 * Moving to another trigger, the card glides there and takes the new
 * content's height, rather than closing and opening again.
 */
function HoverCardContent({
  className,
  side = "top",
  align,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<PreviewCardPrimitive.Positioner.Props, "align" | "side">) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={8}
        // Sized to the card, so what the card lets through isn't caught here.
        className="pointer-events-none isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,right,bottom,left] duration-240 ease-smooth data-instant:transition-none motion-reduce:transition-none"
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "pointer-events-auto relative h-(--popup-height,auto) w-72 origin-(--transform-origin) rounded-xl bg-popover p-3 text-sm text-popover-foreground shadow-float transition-[opacity,scale,height] duration-[150ms,150ms,240ms] ease-smooth outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

/**
 * Holds the card's content as it moves between triggers: the old content
 * fades out as the new comes in from the side the pointer went.
 */
function HoverCardViewport({
  className,
  ...props
}: PreviewCardPrimitive.Viewport.Props) {
  return (
    <PreviewCardPrimitive.Viewport
      data-slot="hover-card-viewport"
      className={cn(
        "relative size-full overflow-clip [&>*]:transition-[translate,opacity] [&>*]:duration-200 [&>*]:ease-smooth motion-reduce:[&>*]:transition-none [&>[data-current][data-starting-style]]:opacity-0 data-[activation-direction~='down']:[&>[data-current][data-starting-style]]:translate-y-2 data-[activation-direction~='left']:[&>[data-current][data-starting-style]]:-translate-x-3 data-[activation-direction~='right']:[&>[data-current][data-starting-style]]:translate-x-3 data-[activation-direction~='up']:[&>[data-current][data-starting-style]]:-translate-y-2 [&>[data-previous]]:w-(--popup-width) [&>[data-previous][data-ending-style]]:opacity-0 data-[activation-direction~='down']:[&>[data-previous][data-ending-style]]:-translate-y-2 data-[activation-direction~='left']:[&>[data-previous][data-ending-style]]:translate-x-3 data-[activation-direction~='right']:[&>[data-previous][data-ending-style]]:-translate-x-3 data-[activation-direction~='up']:[&>[data-previous][data-ending-style]]:translate-y-2",
        className,
      )}
      {...props}
    />
  );
}

export {
  createHoverCardHandle,
  HoverCard,
  HoverCardContent,
  type HoverCardHandle,
  HoverCardTrigger,
  HoverCardViewport,
};
