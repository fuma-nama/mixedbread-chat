import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

/** A crisp 1px edge that warms into a soft glow on focus. */
function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg bg-card px-3 text-base text-foreground shadow-[0_0_0_1px_var(--input),0_1px_2px_oklch(0.235_0.02_48/0.04)] transition-shadow duration-150 ease-smooth outline-none placeholder:text-muted-foreground/75 focus-visible:shadow-[0_0_0_1px_var(--crust),0_0_0_4px_oklch(from_var(--crust)_l_c_h/0.16)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[0_0_0_1px_var(--destructive),0_0_0_4px_oklch(from_var(--destructive)_l_c_h/0.12)] md:text-[14.5px]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
