"use client";

import { Drawer } from "@base-ui/react/drawer";
import { cn } from "cn";
import { PanelLeftIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shortcut } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMobile } from "@/hooks/use-media";
import { useWindowEvent } from "@/hooks/use-window-event";
import { remember } from "@/lib/remember";

interface SidebarContextValue {
  /** Whether the sidebar is expanded on wide screens. */
  open: boolean;
  /** Whether the drawer is showing on phones. */
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  mobile: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>(null!);

export function SidebarProvider({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const mobile = useMobile();
  const [open, setOpen] = useState(defaultOpen);
  // The drawer belongs to the page it opened over, so opening a chat closes it.
  const [drawerPage, setDrawerPage] = useState<string>();
  const openMobile = mobile && drawerPage === pathname;

  function setOpenMobile(open: boolean) {
    setDrawerPage(open ? pathname : undefined);
  }

  function toggle() {
    if (mobile) {
      setOpenMobile(!openMobile);
      return;
    }
    setOpen(!open);
    remember("sidebar_state", String(!open));
  }

  useWindowEvent("keydown", (event) => {
    if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      toggle();
    }
  });

  return (
    <SidebarContext value={{ open, openMobile, setOpenMobile, mobile, toggle }}>
      <div
        data-sidebar={open ? "expanded" : "collapsed"}
        className="group/shell flex h-dvh overflow-hidden bg-background"
      >
        {children}
      </div>
    </SidebarContext>
  );
}

/** Its content mounts in the aside or the drawer, never both. */
export function Sidebar({ children }: { children: React.ReactNode }) {
  const { open, openMobile, setOpenMobile, mobile } = use(SidebarContext);

  return (
    <>
      <aside
        aria-label="Sidebar"
        inert={!open}
        className="hidden w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-smooth group-data-[sidebar=expanded]/shell:w-64 motion-reduce:transition-none md:block"
      >
        <div className="flex h-full w-64 flex-col transition-[opacity,translate] duration-300 ease-smooth group-data-[sidebar=collapsed]/shell:-translate-x-3 group-data-[sidebar=collapsed]/shell:opacity-0 motion-reduce:transition-none">
          {!mobile && children}
        </div>
      </aside>
      <Drawer.Root
        open={openMobile}
        onOpenChange={setOpenMobile}
        swipeDirection="left"
      >
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 bg-[oklch(0.2_0.02_48/0.25)] opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-450 ease-drawer data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 dark:bg-black/55" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex">
            <Drawer.Popup className="flex h-full w-[min(18rem,85vw)] [transform:translateX(var(--drawer-swipe-movement-x))] flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-float transition-transform duration-450 ease-drawer outline-none data-ending-style:[transform:translateX(-100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateX(-100%)] data-swiping:select-none motion-reduce:transition-none">
              <Drawer.Title className="sr-only">Chats</Drawer.Title>
              {children}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

export function SidebarInset({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-smooth motion-reduce:transition-none md:py-2 md:pr-2 md:group-data-[sidebar=collapsed]/shell:pl-2">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-panel md:rounded-2xl md:shadow-raised md:ring-1 md:ring-soft">
        {children}
      </div>
    </main>
  );
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { open, openMobile, mobile, toggle } = use(SidebarContext);
  const label = (mobile ? openMobile : open) ? "Close sidebar" : "Open sidebar";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("text-muted-foreground", className)}
            aria-label={label}
            onClick={toggle}
          />
        }
      >
        <PanelLeftIcon />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        <Shortcut keys={["B"]} />
      </TooltipContent>
    </Tooltip>
  );
}
