"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { backdropClassName, popupClassName } from "@/components/ui/dialog";

export {
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogTitle as AlertDialogTitle,
} from "@/components/ui/dialog";

export const AlertDialog = AlertDialogPrimitive.Root;

export const createAlertDialogHandle = AlertDialogPrimitive.createHandle;

export function AlertDialogContent(props: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className={backdropClassName} />
      <AlertDialogPrimitive.Popup
        className={cn(popupClassName, "max-w-sm")}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

export function AlertDialogCancel(props: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      render={<Button variant="ghost" />}
      {...props}
    />
  );
}
