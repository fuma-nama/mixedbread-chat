"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  backdropClassName,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  popupClassName,
} from "@/components/ui/dialog";

const AlertDialog = AlertDialogPrimitive.Root;

const createAlertDialogHandle = AlertDialogPrimitive.createHandle;

type AlertDialogHandle<Payload> = AlertDialogPrimitive.Handle<Payload>;

function AlertDialogContent({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop
        data-slot="alert-dialog-overlay"
        className={backdropClassName}
      />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(popupClassName, "max-w-sm", className)}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function AlertDialogCancel(props: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant="ghost" />}
      {...props}
    />
  );
}

// An alert dialog's title, description and footer are a dialog's.
export {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  type AlertDialogHandle,
  AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
  createAlertDialogHandle,
};
