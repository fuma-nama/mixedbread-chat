"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const backdropClassName =
  "fixed inset-0 z-50 bg-[oklch(0.2_0.02_48/0.22)] backdrop-blur-[2px] transition-opacity duration-200 ease-smooth data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/50";

export const popupClassName =
  "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl bg-popover p-5 text-sm text-popover-foreground shadow-float outline-none transition-[opacity,scale] duration-200 ease-smooth data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none";

export const Dialog = DialogPrimitive.Root;

export const DialogTrigger = DialogPrimitive.Trigger;

export const createDialogHandle = DialogPrimitive.createHandle;

export function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={backdropClassName} />
      <DialogPrimitive.Popup
        className={cn(popupClassName, className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-3.5 right-3.5 text-muted-foreground"
            />
          }
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5 pr-8">{children}</div>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-[17px] leading-snug font-medium tracking-[-0.01em]",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn(
        "text-[13.5px] leading-relaxed text-pretty text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
