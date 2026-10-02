import { cn } from "cn";

/** Follows the hovered or focused `[data-row]`; rows need a position to paint above it. */
export function HoverArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div ref={follow} className={cn("relative", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-[oklch(from_var(--foreground)_l_c_h/0.055)] opacity-0 transition-opacity duration-200 ease-smooth motion-safe:data-glide:transition-[translate,height,opacity]"
      />
      {children}
    </div>
  );
}

function follow(area: HTMLDivElement) {
  const block = area.firstElementChild as HTMLElement;
  let current: HTMLElement | null = null;

  const show = (row: HTMLElement | null) => {
    if (row === current) return;
    // From another row it glides; arriving from outside it appears in place.
    block.toggleAttribute("data-glide", current !== null);
    current = row;
    if (!row) {
      block.style.opacity = "0";
      return;
    }
    const top =
      row.getBoundingClientRect().top - area.getBoundingClientRect().top;
    block.style.translate = `0 ${top}px`;
    block.style.height = `${row.offsetHeight}px`;
    block.style.opacity = "1";
  };
  const rowOf = (event: Event) =>
    (event.target as Element).closest<HTMLElement>("[data-row]");

  // Over a heading or a gap, it holds its place instead of flickering off.
  const onOver = (event: PointerEvent) => {
    const row = rowOf(event);
    if (row && event.pointerType === "mouse") show(row);
  };
  const onLeave = () => show(null);
  const onFocus = (event: FocusEvent) => {
    if ((event.target as Element).matches(":focus-visible")) show(rowOf(event));
  };
  const onBlur = () => {
    if (!area.matches(":hover")) show(null);
  };
  const listening = new AbortController();
  const { signal } = listening;
  area.addEventListener("pointerover", onOver, { signal });
  area.addEventListener("pointerleave", onLeave, { signal });
  area.addEventListener("focusin", onFocus, { signal });
  area.addEventListener("focusout", onBlur, { signal });
  return () => listening.abort();
}
