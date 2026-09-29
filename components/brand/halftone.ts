/*
 * Halftone prints of the Mixedbread mark and of a slice of bread, on the same
 * hex grid, with each dot of one paired to a dot of the other so the mark can
 * flow into the bread and back. Pure layout: `HalftoneMark` animates it.
 */

/**
 * `SliceGlyph`'s slice, and its bounds in its 16 × 16 box. A copy, so pages
 * with only the mark don't load the glyph.
 */
const SLICE =
  "M2.9 8.2C1.9 7.9 1.2 7.2 1.2 6.2 1.2 3.6 4.3 1.6 8 1.6s6.8 2 6.8 4.6c0 1-.7 1.7-1.7 2v5.2c0 .8-.6 1.4-1.4 1.4H4.3c-.8 0-1.4-.6-1.4-1.4z";
const SLICE_BOX = { x: 1.2, y: 1.6, width: 13.6, height: 13.2 };

/** The bread's inks, read from CSS so they follow the theme. */
export const INKS = ["--honey", "--crust", "--shade"];
const CRUMB = 0;
const CRUST = 1;
const SHADE = 2;

/** How long a dot takes to settle, and how far apart the first and last start. */
export const SETTLE = 0.7;
export const SPREAD = 0.6;

/**
 * Each dot rides a spring between the mark and the bread. `stagger` is how
 * far apart, in seconds, the first and last dot leave; the springs land in
 * about half a second with a touch of overshoot, and a little sooner going home.
 */
export const MORPH = {
  out: { stagger: 0.3, stiffness: 170, damping: 18 },
  back: { stagger: 0.22, stiffness: 220, damping: 22 },
};
/** How far each path bows towards the pointer, as a share of the way there. */
const PULL = 0.3;

export type Rgb = [number, number, number];

/** A dot at rest in one of the two prints. */
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
  /** Which of `INKS` it is printed in. */
  ink: number;
}

/** One dot, travelling between its spot in the mark and its spot in the bread. */
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
  /** Where it was last drawn. */
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

/** A layer averaged over one cell of the grid. */
interface Tone {
  x: number;
  y: number;
  coverage: number;
  color: Rgb;
}

/**
 * Paints a layer at twice the size, then averages each cell of a hex grid over
 * it: how much of the cell it covers, and in what colour. Layers painted onto
 * the same size come back cell for cell in the same order.
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
      // The pixels around the cell's center, within the canvas.
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

/** Samples the mark into dots that fit `width` × `height`. */
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

/**
 * Prints a slice of bread, face on, on the same grid: honey crumb inside a
 * denser ring of crust, with a little shade dropped to the lower right.
 */
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

  /** The slice scaled into place, nudged by `dx`, `dy`. */
  const placed = (dx = 0, dy = 0) => {
    const path = new Path2D();
    path.addPath(
      new Path2D(SLICE),
      new DOMMatrix([
        size,
        0,
        0,
        size,
        left - SLICE_BOX.x * size + dx,
        top - SLICE_BOX.y * size + dy,
      ]),
    );
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

/** The part of `items` in strip `index` of `count` equal strips. */
function strip<T>(items: T[], index: number, count: number): T[] {
  return items.slice(
    Math.floor((index * items.length) / count),
    Math.floor(((index + 1) * items.length) / count),
  );
}

/**
 * The mark's dots paired with the bread's for a `width` × `height` box, so
 * paths flow side by side instead of crossing: both are cut into the same
 * number of strips from left to right, then paired from top to bottom within
 * each strip. Where one side has fewer dots, some of its spots are shared,
 * and the extra copy has no size there: it splits off a dot on the way out,
 * or merges into one on arrival.
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

/** Bows a dot's path towards `x`, `y`, less so for short trips. */
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
 * Advances a dot's spring by `dt` seconds towards its goal. Leaving from rest
 * it takes a new path; turned around mid-flight it keeps the one it is on, so
 * it heads back from exactly where it is. Returns whether it is still moving.
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
