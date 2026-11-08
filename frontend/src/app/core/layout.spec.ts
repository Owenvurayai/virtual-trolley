import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../testing/fakes';
import { Layout, Point, Rect, buildLayout, pathLength, route } from './layout';

const layout = buildLayout(PRODUCTS, ['cashier-1', 'cashier-2'], 5);

/** Strictly inside a rectangle (touching the edge is fine: you can walk along a shelf). */
function inside(p: Point, r: Rect): boolean {
  return p.x > r.x + 0.01 && p.x < r.x + r.w - 0.01 && p.y > r.y + 0.01 && p.y < r.y + r.h - 0.01;
}

function crossesShelf(l: Layout, from: Point, path: Point[]): boolean {
  let prev = from;
  for (const p of path) {
    const steps = Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 1 : i / steps;
      const sample = { x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t };
      if (l.shelves.some((s) => inside(sample, s))) {
        return true;
      }
    }
    prev = p;
  }
  return false;
}

describe('buildLayout', () => {
  it('puts every product on a shelf with a place to stand', () => {
    for (const product of PRODUCTS) {
      expect(layout.standPoint(product.id), `product ${product.id}`).toBeDefined();
    }
    expect(layout.standPoint(999)).toBeUndefined();
  });

  it('arranges twelve products in four aisles of three', () => {
    expect(layout.shelves.length).toBe(4);
    expect(layout.shelves.every((s) => s.cells.length === 3)).toBe(true);
  });

  it('stands customers on the walkway below their shelf, never inside it', () => {
    for (const shelf of layout.shelves) {
      for (const cell of shelf.cells) {
        expect(cell.stand.y).toBeGreaterThan(shelf.y + shelf.h);
        expect(cell.stand.x).toBeGreaterThan(cell.x);
        expect(cell.stand.x).toBeLessThan(cell.x + cell.w);
      }
    }
  });

  it('spaces the tills evenly across the top and gives each a service spot', () => {
    expect(layout.tills.map((t) => t.name)).toEqual(['cashier-1', 'cashier-2']);
    expect(layout.tills[1].service.x - layout.tills[0].service.x).toBeCloseTo(layout.width / 3, 5);
    expect(layout.tills.every((t) => t.service.y > t.counter.y + t.counter.h)).toBe(true);
  });

  it('has one rack slot per trolley and a visible queue', () => {
    expect(layout.rack.length).toBe(5);
    expect(layout.queue.length).toBeGreaterThanOrEqual(5);
  });

  it('adapts to the number of products, tills and trolleys', () => {
    const small = buildLayout(PRODUCTS.slice(0, 4), ['cashier-1', 'cashier-2', 'cashier-3'], 3);

    expect(small.shelves.length).toBe(2);
    expect(small.tills.length).toBe(3);
    expect(small.rack.length).toBe(3);
  });
});

describe('route', () => {
  const points: Record<string, Point> = {
    door: layout.door, exit: layout.exit,
    ...Object.fromEntries(layout.rack.map((p, i) => [`rack${i + 1}`, p])),
    ...Object.fromEntries(PRODUCTS.map((p) => [`shelf${p.id}`, layout.standPoint(p.id)!])),
    ...Object.fromEntries(layout.queue.map((p, i) => [`queue${i}`, p])),
    ...Object.fromEntries(layout.tills.map((t) => [t.name, t.service])),
  };

  it('never walks through a shelf, between any two places in the shop', () => {
    const names = Object.keys(points);
    let checked = 0;
    for (const a of names) {
      for (const b of names) {
        const path = route(layout, points[a], points[b]);
        expect(crossesShelf(layout, points[a], path), `${a} -> ${b}`).toBe(false);
        checked++;
      }
    }
    expect(checked).toBe(names.length * names.length);
  });

  it('always ends exactly at the destination', () => {
    const path = route(layout, layout.rack[0], layout.standPoint(7)!);

    expect(path.at(-1)).toEqual(layout.standPoint(7));
  });

  it('goes straight when the destination is in the same zone', () => {
    expect(route(layout, layout.queue[0], layout.tills[0].service)).toEqual([layout.tills[0].service]);
  });

  it('goes straight along a shared walkway', () => {
    const [a, b] = layout.shelves[1].cells.map((c) => c.stand);

    expect(route(layout, a, b)).toEqual([b]);
  });

  it('uses a side corridor to change aisles', () => {
    const from = layout.shelves[0].cells[1].stand;
    const to = layout.shelves[3].cells[1].stand;

    const path = route(layout, from, to);

    expect(path.length).toBe(3);
    expect(layout.corridors).toContain(path[0].x);
  });

  it('measures path length', () => {
    expect(pathLength({ x: 0, y: 0 }, [{ x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
    expect(pathLength({ x: 0, y: 0 }, [])).toBe(0);
  });
});
