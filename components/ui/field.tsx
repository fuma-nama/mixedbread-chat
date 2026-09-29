"use client";

import { cn } from "cn";

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
    />
  );
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn("group/field flex w-full flex-col gap-2", className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- callers pass htmlFor
    <label
      data-slot="field-label"
      className={cn(
        "flex items-center justify-between gap-2 text-[13px] font-medium text-foreground/85 select-none",
        className,
      )}
      {...props}
    />
  );
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn(
        "text-[13px] text-destructive motion-safe:animate-rise motion-safe:[animation-duration:280ms]",
        className,
      )}
      {...props}
    />
  );
}

export { Field, FieldError, FieldGroup, FieldLabel };
