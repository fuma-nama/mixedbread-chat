"use client";

import { Toast } from "@base-ui/react/toast";

/** Call from anywhere: `toast.add({ title: "Link copied" })`. */
export const toast = Toast.createToastManager();

/** Provides `toast` and draws the stack at the bottom of the screen. */
export function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toast} timeout={4000} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-60 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2">
          <Toasts />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function Toasts() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((item) => (
    <Toast.Root
      key={item.id}
      toast={item}
      swipeDirection="down"
      className="absolute bottom-0 left-0 z-[calc(1000-var(--toast-index))] h-(--height) w-full origin-bottom [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-xl bg-foreground text-background shadow-float select-none [--gap:0.5rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.5rem] [--scale:calc(max(0,1-(var(--toast-index)*0.06)))] [--shrink:calc(1-var(--scale))] [transition:transform_450ms_var(--ease-smooth),opacity_300ms,height_150ms] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full data-ending-style:opacity-0 data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))] data-limited:opacity-0 data-starting-style:[transform:translateY(120%)_scale(0.9)] data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+120%))] motion-reduce:transition-none [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(120%)_scale(0.9)]"
    >
      <Toast.Content className="flex items-center gap-3 overflow-hidden py-2.5 pr-2 pl-3.5 transition-opacity duration-250 data-behind:opacity-0 data-expanded:opacity-100">
        <div className="flex min-w-0 flex-1 flex-col">
          <Toast.Title className="truncate text-[13px] font-medium" />
          <Toast.Description className="text-[12.5px] text-background/70" />
        </div>
        <Toast.Action className="h-7 shrink-0 cursor-pointer rounded-md bg-background/12 px-2.5 text-[12.5px] font-medium outline-offset-2 outline-ring transition-colors hover:bg-background/20 focus-visible:outline-2" />
      </Toast.Content>
    </Toast.Root>
  ));
}
