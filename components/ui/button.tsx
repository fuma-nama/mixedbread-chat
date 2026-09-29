import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "cn";

const variants = {
  default:
    "bg-primary text-primary-foreground shadow-raised hover:bg-primary/88",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent",
  outline:
    "bg-card text-foreground shadow-raised ring-1 ring-soft hover:bg-accent aria-expanded:bg-accent",
  ghost:
    "text-foreground/80 hover:bg-soft hover:text-foreground aria-expanded:bg-soft aria-expanded:text-foreground",
  destructive:
    "bg-destructive text-white shadow-raised hover:bg-destructive/90",
  link: "text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground",
};

const sizes = {
  default: "h-9 gap-2 rounded-lg px-3.5 text-sm",
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  xs: "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
  lg: "h-10 gap-2 rounded-xl px-4 text-sm",
  icon: "size-9 rounded-lg",
  "icon-sm": "size-8 rounded-lg",
  "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
};

interface ButtonVariants {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}

/** The button's classes, with `className` merged over the variant's own. */
function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: ButtonVariants = {}) {
  return cn(
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap outline-offset-2 outline-ring transition-[background-color,color,box-shadow,scale,opacity] duration-150 ease-smooth select-none focus-visible:outline-2 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 data-disabled:pointer-events-none data-disabled:opacity-40 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    variants[variant],
    sizes[size],
    className,
  );
}

function Button({
  variant,
  size,
  className,
  ...props
}: Omit<ButtonPrimitive.Props, "className"> & ButtonVariants) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
