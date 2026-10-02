"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { indicator, popup } from "./popup";

export const DropdownMenu = MenuPrimitive.Root;

export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export const DropdownMenuGroup = MenuPrimitive.Group;

export const DropdownMenuSub = MenuPrimitive.SubmenuRoot;

export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  align = "start",
  alignOffset,
  side,
  sideOffset = 6,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            popup,
            "max-h-(--available-height) min-w-44 scrollbar-thin overflow-y-auto p-1",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

const item =
  "group/dropdown-menu-item relative flex min-h-8 cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] text-foreground/90 transition-colors duration-100 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-soft data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-highlighted:[&_svg:not([class*='text-'])]:text-foreground";

export function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  variant?: "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      data-variant={variant}
      className={cn(
        item,
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:[&_svg]:text-destructive!",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLinkItem(props: MenuPrimitive.LinkItem.Props) {
  return <MenuPrimitive.LinkItem className={item} {...props} />;
}

export function DropdownMenuSubTrigger({
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(item, "data-popup-open:bg-soft")}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3.5" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export function DropdownMenuSubContent(
  props: React.ComponentProps<typeof DropdownMenuContent>,
) {
  return <DropdownMenuContent alignOffset={-4} sideOffset={2} {...props} />;
}

export function DropdownMenuRadioItem({
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem className={cn(item, "pr-8")} {...props}>
      {children}
      <MenuPrimitive.RadioItemIndicator className={indicator}>
        <CheckIcon className="size-3.5 text-foreground!" />
      </MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "px-2 pt-1.5 pb-1 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator() {
  return <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-soft" />;
}
