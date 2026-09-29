import { cn } from "cn";

/** Crossfades between two icons in one spot, like copy turning into a check. */
function IconSwap({
  swapped,
  from,
  to,
  className,
}: {
  swapped: boolean;
  from: React.ReactNode;
  to: React.ReactNode;
  className?: string;
}) {
  const layer =
    "col-start-1 row-start-1 flex transition-[opacity,scale,filter] duration-200 ease-smooth data-[shown=false]:scale-50 data-[shown=false]:opacity-0 data-[shown=false]:blur-[2px] motion-reduce:transition-none";

  return (
    <span
      data-slot="icon-swap"
      className={cn("inline-grid place-items-center", className)}
    >
      <span data-shown={!swapped} aria-hidden={swapped} className={layer}>
        {from}
      </span>
      <span data-shown={swapped} aria-hidden={!swapped} className={layer}>
        {to}
      </span>
    </span>
  );
}

export { IconSwap };
