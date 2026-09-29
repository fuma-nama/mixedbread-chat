import { cn } from "cn";

/**
 * Rows with a soft block that glides to whichever one the mouse is over (or
 * keyboard focus is on) and fades once the pointer leaves. Rows are the
 * `[data-row]` elements inside; they need a position so they paint above it.
 */
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

/** Moves the area's block, its first child, to the row being pointed at. */
function follow(area: HTMLDivElement | null) {
  const block = area?.firstElementChild;
  if (!area || !(block instanceof HTMLElement)) return;
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
  const rowOf = (target: EventTarget | null) =>
    target instanceof Element
      ? target.closest<HTMLElement>("[data-row]")
      : null;

  // Over a heading or a gap, it holds its place instead of flickering off.
  const onOver = (event: PointerEvent) => {
    const row = rowOf(event.target);
    if (row && event.pointerType === "mouse") show(row);
  };
  const onLeave = () => show(null);
  const onFocus = (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof Element && target.matches(":focus-visible")) {
      show(rowOf(target));
    }
  };
  const onBlur = () => {
    if (!area.matches(":hover")) show(null);
  };
  area.addEventListener("pointerover", onOver);
  area.addEventListener("pointerleave", onLeave);
  area.addEventListener("focusin", onFocus);
  area.addEventListener("focusout", onBlur);
  return () => {
    area.removeEventListener("pointerover", onOver);
    area.removeEventListener("pointerleave", onLeave);
    area.removeEventListener("focusin", onFocus);
    area.removeEventListener("focusout", onBlur);
  };
}
