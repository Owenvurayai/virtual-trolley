import { Product } from './models';

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  w: number;
  h: number;
}

export interface ShelfCell {
  productId: number;
  x: number;
  w: number;
  stand: Point; // where a customer stands to pick this product
}

export interface Shelf extends Rect {
  cells: ShelfCell[];
}

export interface Till {
  name: string;
  counter: Rect;
  cashier: Point; // cashier stands behind the counter
  service: Point; // customer stands here while being served
}

export interface Layout {
  width: number;
  height: number;
  shelves: Shelf[];
  tills: Till[];
  queue: Point[];
  rack: Point[];
  door: Point;
  exit: Point;
  corridors: number[]; // x of the two side walkways
  topY: number;        // above this: till zone, free movement
  bottomY: number;     // below this: entrance zone, free movement
  standPoint(productId: number): Point | undefined;
}

// Logical units, not pixels: the canvas scales the whole map to fit the screen.
export const WORLD_WIDTH = 480;
const PER_AISLE = 3;
const SHELF_H = 34;
const SHELF_X = 52;
const FIRST_SHELF_Y = 304;
const AISLE_STEP = 100;
const QUEUE_SLOTS = 5;
const QUEUE_STEP = 30; // room for a trolley between neighbours

/** Portrait map: tills on top, aisles in the middle, entrance at the bottom. */
export function buildLayout(
  products: readonly Pick<Product, 'id'>[],
  cashierNames: readonly string[],
  trolleyCount: number,
): Layout {
  const aisles = Math.max(1, Math.ceil(products.length / PER_AISLE));
  const shelfW = WORLD_WIDTH - 2 * SHELF_X;
  const cellW = shelfW / PER_AISLE;

  const shelves: Shelf[] = [];
  const stands = new Map<number, Point>();
  for (let a = 0; a < aisles; a++) {
    const y = FIRST_SHELF_Y + a * AISLE_STEP;
    const cells: ShelfCell[] = [];
    products.slice(a * PER_AISLE, (a + 1) * PER_AISLE).forEach((product, k) => {
      const x = SHELF_X + k * cellW;
      const stand = { x: x + cellW / 2, y: y + SHELF_H + 22 }; // walkway below the shelf
      cells.push({ productId: product.id, x, w: cellW, stand });
      stands.set(product.id, stand);
    });
    shelves.push({ x: SHELF_X, y, w: shelfW, h: SHELF_H, cells });
  }

  const lastWalkY = FIRST_SHELF_Y + (aisles - 1) * AISLE_STEP + SHELF_H + 22;
  const laneY = lastWalkY + 70;
  const doorY = laneY + 55;

  const tills = cashierNames.map((name, i): Till => {
    const x = (WORLD_WIDTH / (cashierNames.length + 1)) * (i + 1);
    return {
      name,
      counter: { x: x - 52, y: 44, w: 104, h: 30 },
      cashier: { x, y: 30 },
      service: { x, y: 104 },
    };
  });

  return {
    width: WORLD_WIDTH,
    height: doorY + 34,
    shelves,
    tills,
    queue: Array.from({ length: QUEUE_SLOTS }, (_, i) => ({ x: WORLD_WIDTH / 2, y: 150 + i * QUEUE_STEP })),
    rack: Array.from({ length: trolleyCount }, (_, i) => ({ x: 44 + i * 32, y: laneY })),
    door: { x: WORLD_WIDTH / 2, y: doorY },
    exit: { x: WORLD_WIDTH - 56, y: doorY },
    corridors: [24, WORLD_WIDTH - 24],
    topY: FIRST_SHELF_Y - 24,
    bottomY: laneY - 20,
    standPoint: (productId) => stands.get(productId),
  };
}

type Zone = 'top' | 'aisles' | 'bottom';

function zoneOf(layout: Layout, p: Point): Zone {
  return p.y < layout.topY ? 'top' : p.y >= layout.bottomY ? 'bottom' : 'aisles';
}

/**
 * Waypoints from one point to another, never crossing a shelf.
 * Inside the top or bottom zone: straight line. Otherwise: out to the nearest
 * side corridor, along it, then in along the destination's row.
 */
export function route(layout: Layout, from: Point, to: Point): Point[] {
  const zone = zoneOf(layout, from);
  if ((zone === 'top' || zone === 'bottom') && zone === zoneOf(layout, to)) {
    return [to];
  }
  if (Math.abs(from.y - to.y) < 0.5) {
    return [to]; // same walkway row
  }
  const cx = layout.corridors.reduce((best, c) =>
    Math.abs(from.x - c) + Math.abs(to.x - c) < Math.abs(from.x - best) + Math.abs(to.x - best) ? c : best);

  const path: Point[] = [{ x: cx, y: from.y }, { x: cx, y: to.y }, to];
  return path.filter((p, i) => {
    const prev = i === 0 ? from : path[i - 1];
    return Math.hypot(p.x - prev.x, p.y - prev.y) > 0.5; // drop zero-length hops
  });
}

export function pathLength(from: Point, path: readonly Point[]): number {
  let total = 0;
  let prev = from;
  for (const p of path) {
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return total;
}
