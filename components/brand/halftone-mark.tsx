"use client";

import { subscribeTheme } from "@/hooks/use-theme";
import { SLICE_PATH } from "./slice";

// The Mixedbread mark and a bread slice as halftone dots on one hex grid, each dot paired across the two.

/** The slice's bounds in its 16 × 16 box. */
const SLICE_BOX = { x: 1.2, y: 1.6, width: 13.6, height: 13.2 };
const INKS = ["--honey", "--crust", "--shade"];
const CRUMB = 0;
const CRUST = 1;
const SHADE = 2;
/** Seconds a dot takes to settle, and between the first and last starting. */
const SETTLE = 0.7;
const SPREAD = 0.6;
/** Seconds between two passes of light, and how long one takes. */
const EVERY = 7;
const PASS = 1.4;
/** How much a dot slims mid-flight, so the crowd reads as one flow. */
const SLIM = 0.35;
/** How far each path bows towards the pointer, as a share of the way there. */
const PULL = 0.3;
/** `stagger`: seconds between the first and last to leave. */
const MORPH = {
  out: { stagger: 0.3, stiffness: 170, damping: 18 },
  back: { stagger: 0.22, stiffness: 220, damping: 22 },
};

type Rgb = [number, number, number];

interface Spot {
  x: number;
  y: number;
  radius: number;
  /** Where along the pass of light the dot sits, from 0 to 1. */
  band: number;
}

interface MarkSpot extends Spot {
  color: Rgb;
  /** Where the dot starts the intro, relative to where it lands, and when. */
  fromX: number;
  fromY: number;
  delay: number;
}

interface BreadSpot extends Spot {
  /** An index into `INKS`. */
  ink: number;
}

interface Dot {
  home: MarkSpot;
  slot: BreadSpot;
  /** A shared spot is drawn once: the copy has no size there. */
  homeRadius: number;
  slotRadius: number;
  /** 0 at home, 1 in the bread; the spring overshoots both a little. */
  progress: number;
  speed: number;
  goal: number;
  /** The goal to take up at `at`, which staggers the crowd. */
  next: number;
  at: number;
  /** Where the path bows through, set each time the dot leaves from rest. */
  bendX: number;
  bendY: number;
  x: number;
  y: number;
  /** Per dot, so the crowd doesn't move in lockstep. */
  stiffness: number;
  jitter: number;
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

// Stable noise per dot, so each settles along its own path every time.
function noise(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Layers of one size come back cell for cell in the same order. */
function sample(
  width: number,
  height: number,
  cell: number,
  paint: (context: CanvasRenderingContext2D) => void,
) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  const w = (canvas.width = Math.ceil(width * scale));
  const h = (canvas.height = Math.ceil(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !w || !h) return [];
  context.scale(scale, scale);
  paint(context);
  const { data } = context.getImageData(0, 0, w, h);

  const tones: { x: number; y: number; coverage: number; color: Rgb }[] = [];
  const rowStep = (cell * Math.sqrt(3)) / 2;
  const reach = Math.max(1, Math.round((cell * scale) / 2));

  for (let row = 0, y = cell / 2; y < height; row++, y += rowStep) {
    for (let x = cell / 2 + (row % 2) * (cell / 2); x < width; x += cell) {
      const cx = Math.round(x * scale);
      const cy = Math.round(y * scale);
      const left = Math.max(cx - reach, 0);
      const right = Math.min(cx + reach, w - 1);
      const top = Math.max(cy - reach, 0);
      const bottom = Math.min(cy + reach, h - 1);
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let sy = top; sy <= bottom; sy++) {
        const end = (sy * w + right) * 4;
        for (let i = (sy * w + left) * 4; i <= end; i += 4) {
          const a = data[i + 3] / 255;
          red += data[i] * a;
          green += data[i + 1] * a;
          blue += data[i + 2] * a;
          alpha += a;
        }
      }
      tones.push({
        x,
        y,
        coverage: alpha / ((right - left + 1) * (bottom - top + 1)),
        color:
          alpha > 0 ? [red / alpha, green / alpha, blue / alpha] : [0, 0, 0],
      });
    }
  }
  return tones;
}

function printMark(
  image: HTMLImageElement,
  width: number,
  height: number,
  cell: number,
): MarkSpot[] {
  const aspect = image.naturalWidth / image.naturalHeight;
  let w = width * 0.88;
  let h = w / aspect;
  if (h > height * 0.84) {
    h = height * 0.84;
    w = h * aspect;
  }
  const left = (width - w) / 2;
  const top = (height - h) / 2;
  const tones = sample(width, height, cell, (context) =>
    context.drawImage(image, left, top, w, h),
  );

  const spots: MarkSpot[] = [];
  for (const { x, y, coverage, color } of tones) {
    if (coverage < 0.06) continue;
    const [r, g, b] = color;
    // Deeper colours print a little heavier than the light yellow.
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const ink = Math.min(1, 0.72 + (1 - luminance) * 0.55);
    const seed = spots.length + 1;
    const angle = noise(seed) * Math.PI * 2;
    const drift = 4 + noise(seed + 0.3) * 10;
    spots.push({
      x,
      y,
      radius: (cell / 2) * Math.sqrt(coverage) * ink * 0.94,
      band: clamp01(((x - left) / w) * 0.8 + (1 - (y - top) / h) * 0.2),
      color: [r, g, b],
      fromX: Math.cos(angle) * drift - 8,
      fromY: Math.sin(angle) * drift + 4,
      delay: clamp01((x - left) / w) * SPREAD + noise(seed + 0.7) * 0.12,
    });
  }
  return spots;
}

function printBread(width: number, height: number, cell: number): BreadSpot[] {
  const size = Math.min(
    (height * 0.86) / SLICE_BOX.height,
    (width * 0.9) / SLICE_BOX.width,
  );
  const w = SLICE_BOX.width * size;
  const h = SLICE_BOX.height * size;
  const left = (width - w) / 2;
  const top = (height - h) / 2;
  const crust = cell * 1.3;
  // Light from the upper left: the crust runs thicker on the far side.
  const lean = cell * 0.35;
  const drop = cell * 0.9;

  const placed = (dx = 0, dy = 0) => {
    const path = new Path2D();
    const matrix = new DOMMatrix()
      .translateSelf(
        left - SLICE_BOX.x * size + dx,
        top - SLICE_BOX.y * size + dy,
      )
      .scaleSelf(size);
    path.addPath(new Path2D(SLICE_PATH), matrix);
    return path;
  };
  const body = placed();
  const inner = placed(-lean, -lean);
  const shape = sample(width, height, cell, (context) => context.fill(body));
  const inside = sample(width, height, cell, (context) => {
    context.fill(inner);
    context.globalCompositeOperation = "destination-out";
    context.lineWidth = crust * 2;
    context.stroke(inner);
  });
  const shadow = sample(width, height, cell, (context) => {
    context.fill(placed(drop, drop));
    context.globalCompositeOperation = "destination-out";
    context.fill(body);
  });

  const spots: BreadSpot[] = [];
  shape.forEach(({ x, y, coverage }, i) => {
    const band = clamp01(((x - left) / w) * 0.8 + (1 - (y - top) / h) * 0.2);
    const crumb = inside[i]?.coverage ?? 0;
    const cast = shadow[i]?.coverage ?? 0;
    if (coverage >= 0.06) {
      const edge = crumb < coverage * 0.5;
      // Crumb has holes: some dots print lighter than their neighbours.
      const density = edge ? 1 : 0.5 * (0.7 + noise(i * 0.37 + 5) * 0.6);
      spots.push({
        x,
        y,
        radius: (cell / 2) * Math.sqrt(coverage * density) * 0.94,
        band,
        ink: edge ? CRUST : CRUMB,
      });
    } else if (cast >= 0.2) {
      spots.push({
        x,
        y,
        radius: (cell / 2) * Math.sqrt(cast * 0.3) * 0.94,
        band,
        ink: SHADE,
      });
    }
  });
  return spots;
}

function strip<T>(items: T[], index: number, count: number): T[] {
  return items.slice(
    Math.floor((index * items.length) / count),
    Math.floor(((index + 1) * items.length) / count),
  );
}

/** Pairs dots strip by strip, so paths flow side by side. */
function print(image: HTMLImageElement, width: number, height: number): Dot[] {
  const cell = width < 200 ? 3.4 : 3.8;
  const mark = printMark(image, width, height, cell);
  const bread = printBread(width, height, cell);
  if (!mark.length || !bread.length) return [];
  const byX = (a: Spot, b: Spot) => a.x - b.x || a.y - b.y;
  const byY = (a: Spot, b: Spot) => a.y - b.y || a.x - b.x;
  const homes = mark.sort(byX);
  const slots = bread.sort(byX);
  const strips = Math.round(Math.sqrt(Math.min(homes.length, slots.length)));

  const dots: Dot[] = [];
  for (let index = 0; index < strips; index++) {
    const from = strip(homes, index, strips).sort(byY);
    const to = strip(slots, index, strips).sort(byY);
    const count = Math.max(from.length, to.length);
    for (let i = 0; i < count; i++) {
      const home = from[Math.floor((i * from.length) / count)];
      const slot = to[Math.floor((i * to.length) / count)];
      if (!home || !slot) continue;
      const last = dots.at(-1);
      const seed = dots.length + 1;
      dots.push({
        home,
        slot,
        homeRadius: last?.home === home ? 0 : home.radius,
        slotRadius: last?.slot === slot ? 0 : slot.radius,
        progress: 0,
        speed: 0,
        goal: 0,
        next: 0,
        at: 0,
        bendX: (home.x + slot.x) / 2,
        bendY: (home.y + slot.y) / 2,
        x: home.x,
        y: home.y,
        stiffness: 0.88 + noise(seed + 0.2) * 0.24,
        jitter: noise(seed + 0.9),
      });
    }
  }
  return dots;
}

function rest(dot: Dot, at: number) {
  dot.progress = at;
  dot.speed = 0;
  dot.goal = at;
  dot.next = at;
}

function bend(dot: Dot, x: number, y: number) {
  const { home, slot } = dot;
  const midX = (home.x + slot.x) / 2;
  const midY = (home.y + slot.y) / 2;
  // A dot that barely moves shouldn't loop out and back.
  const limit = Math.hypot(slot.x - home.x, slot.y - home.y) * 0.6 + 2;
  const pull = Math.min(PULL, limit / Math.hypot(x - midX, y - midY));
  dot.bendX = midX + (x - midX) * pull;
  dot.bendY = midY + (y - midY) * pull;
}

/** Advances the spring by `dt` seconds; returns whether the dot still moves. */
function step(
  dot: Dot,
  now: number,
  dt: number,
  pointer: { x: number; y: number },
) {
  if (dot.next !== dot.goal && now >= dot.at) {
    if (dot.speed === 0 && dot.progress === dot.goal) {
      bend(dot, pointer.x, pointer.y);
    }
    dot.goal = dot.next;
  }
  if (dot.speed === 0 && dot.progress === dot.goal) {
    return dot.next !== dot.goal;
  }
  const { stiffness, damping } = dot.goal === 1 ? MORPH.out : MORPH.back;
  const k = stiffness * dot.stiffness;
  const c = damping * Math.sqrt(dot.stiffness);
  // Small fixed steps keep the spring steady on slow frames.
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    dot.speed += (k * (dot.goal - dot.progress) - c * dot.speed) * h;
    dot.progress += dot.speed * h;
  }
  if (Math.abs(dot.goal - dot.progress) < 1e-3 && Math.abs(dot.speed) < 1e-2) {
    dot.progress = dot.goal;
    dot.speed = 0;
    return dot.next !== dot.goal;
  }
  return true;
}

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

// Rounding too fine to see, so a frame takes a few dozen fills, not one per dot.
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
  const channel = (shift: number) =>
    Math.round((((key >> shift) & 63) * 255) / 63);
  return `rgb(${channel(12)} ${channel(6)} ${channel(0)} / ${(key >> 18) / 8})`;
}

export function HalftoneMark() {
  return (
    <canvas ref={animate} aria-hidden="true" className="block size-full" />
  );
}

function animate(canvas: HTMLCanvasElement | null) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
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
  const listening = new AbortController();
  const { signal } = listening;
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

    if (signal.aborted || !visible || document.hidden || still) return;
    if (moving || passing || since <= 0) {
      frame = requestAnimationFrame(draw);
    } else {
      wake = window.setTimeout(schedule, (EVERY - into) * 1000);
    }
  };

  const schedule = () => {
    if (frame || !image || signal.aborted || !visible || document.hidden) {
      return;
    }
    window.clearTimeout(wake);
    last = 0;
    frame = requestAnimationFrame(draw);
  };

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
  const watcher = new IntersectionObserver((entries) => {
    visible = entries.at(-1)?.isIntersecting ?? false;
    schedule();
  });

  void loadLogo().then(
    (loaded) => {
      if (signal.aborted) return;
      image = loaded;
      layout();
      start = performance.now();
      paint();
    },
    () => {},
  );
  resizer.observe(canvas);
  watcher.observe(canvas);
  canvas.addEventListener("pointermove", onMove, { signal });
  canvas.addEventListener("pointerleave", onLeave, { signal });
  scheme.addEventListener("change", paint, { signal });
  reduced.addEventListener("change", schedule, { signal });
  document.addEventListener("visibilitychange", schedule, { signal });
  const stopTheme = subscribeTheme(paint);

  return () => {
    listening.abort();
    cancelAnimationFrame(frame);
    window.clearTimeout(wake);
    resizer.disconnect();
    watcher.disconnect();
    stopTheme();
  };
}
