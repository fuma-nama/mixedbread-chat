/** Crossfades between two icons in one spot, like copy turning into a check. */
export function IconSwap({
  swapped,
  from,
  to,
}: {
  swapped: boolean;
  from: React.ReactNode;
  to: React.ReactNode;
}) {
  const layer =
    "col-start-1 row-start-1 flex transition-[opacity,scale,filter] duration-200 ease-smooth data-[shown=false]:scale-50 data-[shown=false]:opacity-0 data-[shown=false]:blur-[2px] motion-reduce:transition-none";

  return (
    <span className="inline-grid place-items-center">
      <span data-shown={!swapped} aria-hidden={swapped} className={layer}>
        {from}
      </span>
      <span data-shown={swapped} aria-hidden={!swapped} className={layer}>
        {to}
      </span>
    </span>
  );
}
