import { useRef } from "react";

interface Press {
  type: string;
  x: number;
  y: number;
  timer: number;
  row?: HTMLElement;
  /** It became a long hold, so the click that ends it neither opens nor toggles. */
  held?: boolean;
}

/** A finger held on a row presses it in, then hands its chat to `onHold`; a mouse never holds. */
export function useHold(onHold: (id: string) => void) {
  const press = useRef<Press>({ type: "", x: 0, y: 0, timer: 0 });

  function release() {
    const { timer, row } = press.current;
    clearTimeout(timer);
    press.current.timer = 0;
    if (row) delete row.dataset.holding;
  }

  function hold() {
    const { row, held } = press.current;
    if (!row?.dataset.id || held) return;
    release();
    press.current.held = true;
    navigator.vibrate?.(8);
    onHold(row.dataset.id);
  }

  return {
    handlers: {
      onPointerDown(event: React.PointerEvent) {
        const row =
          (event.target as Element).closest<HTMLElement>("a[data-id]") ??
          undefined;
        press.current = {
          type: event.pointerType,
          x: event.clientX,
          y: event.clientY,
          timer: 0,
          row,
        };
        if (!row || event.pointerType === "mouse") return;
        row.dataset.holding = "";
        press.current.timer = window.setTimeout(hold, 450);
      },
      onPointerMove(event: React.PointerEvent) {
        const { timer, x, y } = press.current;
        if (timer && Math.hypot(event.clientX - x, event.clientY - y) > 8) {
          release();
        }
      },
      onPointerUp: release,
      onPointerCancel: release,
      // Android opens the link's own menu on a long press, before or after the timer.
      onContextMenu(event: React.MouseEvent) {
        if (press.current.type === "mouse" || !press.current.row) return;
        event.preventDefault();
        hold();
      },
    },
    touch: () => press.current.type !== "mouse",
    /** Swallows the click a hold ends with, and says whether `event` was it. */
    ended(event: React.MouseEvent) {
      if (!press.current.held || event.detail === 0) return false;
      press.current.held = false;
      event.preventDefault();
      return true;
    },
  };
}
