"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
} from "@/components/ui/dropdown-menu";
import { setTheme, useTheme } from "@/hooks/use-theme";
import { type Theme, themes } from "@/lib/theme";

const icons = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

// Where each icon turns in from: the sun spins its rays round, the moon
// swings up like a crescent rising, the screen just pops.
const turns = { system: "0deg", light: "-90deg", dark: "40deg" };

export function ThemeSwitch() {
  const theme = useTheme();
  // Icons turn only when picked here, not each time the menu opens.
  const [picked, setPicked] = useState(false);
  const index = themes.findIndex((entry) => entry.id === theme);

  return (
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={(value: Theme) => {
        setPicked(true);
        setTheme(value);
      }}
      className="flex items-center justify-between gap-3 py-1 pr-1 pl-2"
    >
      <DropdownMenuLabel className="p-0 text-[13.5px] text-foreground/90">
        Theme
      </DropdownMenuLabel>
      <div className="relative flex rounded-full bg-soft p-0.5">
        <span
          aria-hidden="true"
          style={{ translate: `${index * 100}% 0` }}
          className="absolute top-0.5 left-0.5 size-7 rounded-full bg-popover shadow-raised transition-[translate] duration-300 ease-smooth motion-reduce:transition-none"
        />
        {themes.map(({ id, name }) => {
          const Icon = icons[id];
          return (
            <MenuPrimitive.RadioItem
              key={id}
              value={id}
              aria-label={name}
              style={{ "--turn": turns[id] } as React.CSSProperties}
              className="group/theme relative flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none data-checked:text-foreground data-highlighted:text-foreground data-highlighted:not-data-checked:bg-soft"
            >
              <Icon
                className={cn(
                  "size-3.5",
                  picked &&
                    "group-data-checked/theme:motion-safe:animate-theme-turn",
                )}
              />
            </MenuPrimitive.RadioItem>
          );
        })}
      </div>
    </DropdownMenuRadioGroup>
  );
}
