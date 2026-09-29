"use client";

import { subscribeTheme } from "@/hooks/use-theme";
import {
  clamp01,
  type Dot,
  INKS,
  MORPH,
  print,
  type Rgb,
  rest,
  SETTLE,
  SPREAD,
  step,
} from "./halftone";

/*
 * The Mixedbread mark, printed in halftone: one dot per cell of a hex grid,
 * sized by how much of the mark covers it and inked in the mark's own colour.
 * On arrival the dots settle into place like ink, left to right. Afterwards a
 * band of light passes over now and then. A pointer resting on the mark pulls
 * its dots into a slice of bread, printed on the same grid, and they flow back
 * when it leaves. Drawn on a 2D canvas, and only while something moves.
 */

/** Seconds between two passes of light, and how long one takes. */
const EVERY = 7;
const PASS = 1.4;
/** How much a dot slims mid-flight, so the crowd reads as one flow. */
const SLIM = 0.35;

const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
/** Overshoots a little and settles, like a drop of ink spreading. */
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

let logo: Promise<HTMLImageElement> | undefined;

function loadLogo(): Promise<HTMLImageElement> {
  logo ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "/icon.svg";
  });
  return logo;
}

// Canvas takes CSS colours in any space; a 1 × 1 canvas turns them into RGB.
function readInks(element: Element): Rgb[] {
  const probe = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!probe) return [];
  const style = getComputedStyle(element);
  return INKS.map((name) => {
    probe.fillStyle = "#000";
    probe.fillStyle = style.getPropertyValue(name).trim();
    probe.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  });
}

/**
 * Dots are filled a colour at a time. Colours are rounded to 64 steps a
 * channel and alpha to 8, too fine to see at this size, so a frame needs a
 * few dozen fills instead of one per dot.
 */
const styles = new Map<number, string>();

const level = (value: number) => Math.round(clamp01(value / 255) * 63);

function colorKey(r: number, g: number, b: number, alpha: number): number {
  return (
    (Math.round(alpha * 8) << 18) |
    (level(r) << 12) |
    (level(g) << 6) |
    level(b)
  );
}

function styleOf(key: number): string {
  let style = styles.get(key);
  if (!style) {
    const channel = (shift: number) =>
      Math.round((((key >> shift) & 63) * 255) / 63);
    style = `rgb(${channel(12)} ${channel(6)} ${channel(0)} / ${(key >> 18) / 8})`;
    styles.set(key, style);
  }
  return style;
}

export function HalftoneMark() {
  return (
    <div aria-hidden="true" className="size-full">
      <canvas ref={animate} className="block size-full" />
    </div>
  );
}

/** Draws the mark on `canvas` until it unmounts. */
function animate(canvas: HTMLCanvasElement | null) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Either can change the inks: the device's scheme, or a theme picked here.
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const batches = new Map<number, Path2D>();
  let image: HTMLImageElement | undefined;
  let dots: Dot[] = [];
  let inks: Rgb[] = [];
  let width = 0;
  let height = 0;
  let start = 0;
  let last = 0;
  let frame = 0;
  let wake = 0;
  let visible = true;
  let disposed = false;
  const pointer = { x: 0, y: 0, inside: false };

  const layout = () => {
    const rect = canvas.getBoundingClientRect();
    // Already printed at this size, as when the first resize follows the logo.
    if (dots.length && rect.width === width && rect.height === height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A box with no size, say mid-exit or collapsed, has nothing to print.
    dots =
      image && width >= 1 && height >= 1 ? print(image, width, height) : [];
    // Resized under the pointer: straight to the bread, no replay.
    if (pointer.inside && !reduced.matches) {
      for (const dot of dots) rest(dot, 1);
    }
  };

  const draw = (now: number) => {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
    last = now;
    const time = (now - start) / 1000;
    const still = reduced.matches;
    const settled = SPREAD + 0.12 + SETTLE;
    const since = time - settled;
    const into = since % EVERY;
    const passing = !still && since > 0 && into < PASS;
    // The band of light, from off the left edge to past the right.
    const pass = (into / PASS) * 1.5 - 0.25;
    let moving = false;

    batches.clear();
    for (const dot of dots) {
      if (still) {
        rest(dot, 0);
      } else if (step(dot, now, dt, pointer)) {
        moving = true;
      }
      const { home, slot } = dot;
      const intro = still ? 1 : clamp01((time - home.delay) / SETTLE);
      if (intro < 1) moving = true;

      // Along a curve from home, bowed through the bend, to the slot.
      const t = dot.progress;
      const u = 1 - t;
      const settle = easeOutCubic(intro);
      const homeX = home.x + home.fromX * (1 - settle);
      const homeY = home.y + home.fromY * (1 - settle);
      const x = u * u * homeX + 2 * u * t * dot.bendX + t * t * slot.x;
      const y = u * u * homeY + 2 * u * t * dot.bendY + t * t * slot.y;
      dot.x = x;
      dot.y = y;

      const along = clamp01(t);
      const band = home.band + (slot.band - home.band) * along;
      const glint = passing ? Math.exp(-(((band - pass) / 0.09) ** 2)) : 0;
      const radius =
        (dot.homeRadius + (dot.slotRadius - dot.homeRadius) * smooth(along)) *
        (1 - SLIM * Math.sin(Math.PI * along)) *
        easeOutBack(intro) *
        (1 + glint * 0.3);
      const alpha = Math.min(1, intro * 2.2);
      if (radius < 0.1 || alpha <= 0) continue;

      // The logo's colour gives way to the bread's ink along the way.
      const ink = inks[slot.ink] ?? home.color;
      const mix = smooth(clamp01((along - 0.15) / 0.7));
      const key = colorKey(
        home.color[0] + (ink[0] - home.color[0]) * mix,
        home.color[1] + (ink[1] - home.color[1]) * mix,
        home.color[2] + (ink[2] - home.color[2]) * mix,
        alpha,
      );
      let batch = batches.get(key);
      if (!batch) {
        batch = new Path2D();
        batches.set(key, batch);
      }
      batch.moveTo(x + radius, y);
      batch.arc(x, y, radius, 0, Math.PI * 2);
    }

    context.clearRect(0, 0, width, height);
    for (const [key, batch] of batches) {
      context.fillStyle = styleOf(key);
      context.fill(batch);
    }

    if (disposed || !visible || document.hidden || still) return;
    if (moving || passing || since <= 0) {
      frame = requestAnimationFrame(draw);
    } else {
      // Sleep until the next pass of light.
      wake = window.setTimeout(schedule, (EVERY - into) * 1000);
    }
  };

  // Starts drawing unless a frame is already on its way.
  const schedule = () => {
    if (frame || !image || disposed || !visible || document.hidden) return;
    window.clearTimeout(wake);
    last = 0;
    frame = requestAnimationFrame(draw);
  };

  /** Sends every dot towards `goal`, those nearest the pointer first. */
  const aim = (goal: number) => {
    if (reduced.matches) return;
    const { stagger } = goal === 1 ? MORPH.out : MORPH.back;
    const now = performance.now();
    let far = 1;
    for (const dot of dots) {
      far = Math.max(far, Math.hypot(dot.x - pointer.x, dot.y - pointer.y));
    }
    for (const dot of dots) {
      const near = Math.hypot(dot.x - pointer.x, dot.y - pointer.y) / far;
      dot.next = goal;
      dot.at = now + (near * 0.85 + dot.jitter * 0.15) * stagger * 1000;
    }
    schedule();
  };

  const track = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
  };
  const onMove = (event: PointerEvent) => {
    // Touch has no hover, so a finger leaves the mark as it is.
    if (event.pointerType === "touch") return;
    track(event);
    if (pointer.inside) return;
    pointer.inside = true;
    aim(1);
  };
  const onLeave = (event: PointerEvent) => {
    if (!pointer.inside) return;
    track(event);
    pointer.inside = false;
    aim(0);
  };

  const paint = () => {
    inks = readInks(canvas);
    schedule();
  };

  const resizer = new ResizeObserver(() => {
    layout();
    schedule();
  });
  const watcher = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    schedule();
  });

  void loadLogo().then(
    (loaded) => {
      if (disposed) return;
      image = loaded;
      layout();
      start = performance.now();
      paint();
    },
    () => {},
  );
  resizer.observe(canvas);
  watcher.observe(canvas);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  scheme.addEventListener("change", paint);
  const stopTheme = subscribeTheme(paint);
  reduced.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", schedule);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    window.clearTimeout(wake);
    resizer.disconnect();
    watcher.disconnect();
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    scheme.removeEventListener("change", paint);
    stopTheme();
    reduced.removeEventListener("change", schedule);
    document.removeEventListener("visibilitychange", schedule);
  };
}
