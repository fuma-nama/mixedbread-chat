// Halftone prints of the Mixedbread mark and of a slice of bread on one hex
// grid, each dot of one paired with a dot of the other; `HalftoneMark` animates.
import { SLICE_PATH } from "./slice";

/** The slice's bounds in its 16 × 16 box. */
const SLICE_BOX = { x: 1.2, y: 1.6, width: 13.6, height: 13.2 };

/** Read from CSS, so they follow the theme. */
export const INKS = ["--honey", "--crust", "--shade"];
const CRUMB = 0;
const CRUST = 1;
const SHADE = 2;

/** Seconds a dot takes to settle, and between the first and last starting. */
export const SETTLE = 0.7;
export const SPREAD = 0.6;

/** Springs between mark and bread; `stagger` is seconds between the first and last to leave. */
export const MORPH = {
  out: { stagger: 0.3, stiffness: 170, damping: 18 },
  back: { stagger: 0.22, stiffness: 220, damping: 22 },
};
/** How far each path bows towards the pointer, as a share of the way there. */
const PULL = 0.3;

export type Rgb = [number, number, number];

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

export interface Dot {
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

export const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

// Stable noise per dot, so each settles along its own path every time.
function noise(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

interface Tone {
  x: number;
  y: number;
  coverage: number;
  color: Rgb;
}

/**
 * Paints a layer at twice the size, then averages each cell of a hex grid
 * over it. Layers of one size come back cell for cell in the same order.
 */
function sample(
  width: number,
  height: number,
  cell: number,
  paint: (context: CanvasRenderingContext2D) => void,
): Tone[] {
  const scale = 2;
  const canvas = document.createElement("canvas");
  const w = (canvas.width = Math.ceil(width * scale));
  const h = (canvas.height = Math.ceil(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !w || !h) return [];
  context.scale(scale, scale);
  paint(context);
  const { data } = context.getImageData(0, 0, w, h);

  const tones: Tone[] = [];
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

/** Honey crumb inside a denser ring of crust, with shade to the lower right. */
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

/**
 * Pairs the mark's dots with the bread's, so paths flow side by side: both
 * are cut into the same strips from left to right and paired top to bottom
 * within each. Where one side has fewer dots, spots are shared, and the copy
 * has no size: it splits off a dot on the way out, or merges into one.
 */
export function print(
  image: HTMLImageElement,
  width: number,
  height: number,
): Dot[] {
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
      const a = Math.floor((i * from.length) / count);
      const b = Math.floor((i * to.length) / count);
      const home = from[a];
      const slot = to[b];
      if (!home || !slot) continue;
      const sharesHome =
        i > 0 && Math.floor(((i - 1) * from.length) / count) === a;
      const sharesSlot =
        i > 0 && Math.floor(((i - 1) * to.length) / count) === b;
      const seed = dots.length + 1;
      dots.push({
        home,
        slot,
        homeRadius: sharesHome ? 0 : home.radius,
        slotRadius: sharesSlot ? 0 : slot.radius,
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

/** Puts a dot at rest, at home (0) or in the bread (1). */
export function rest(dot: Dot, at: number) {
  dot.progress = at;
  dot.speed = 0;
  dot.goal = at;
  dot.next = at;
}

function bend(dot: Dot, x: number, y: number) {
  const { home, slot } = dot;
  const midX = (home.x + slot.x) / 2;
  const midY = (home.y + slot.y) / 2;
  let dx = (x - midX) * PULL;
  let dy = (y - midY) * PULL;
  // A dot that barely moves shouldn't loop out and back.
  const limit = Math.hypot(slot.x - home.x, slot.y - home.y) * 0.6 + 2;
  const length = Math.hypot(dx, dy);
  if (length > limit) {
    dx *= limit / length;
    dy *= limit / length;
  }
  dot.bendX = midX + dx;
  dot.bendY = midY + dy;
}

/**
 * Advances a dot's spring by `dt` seconds. Leaving from rest it bows towards
 * the pointer; turned around mid-flight it heads back along the same path.
 * Returns whether it is still moving.
 */
export function step(
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
