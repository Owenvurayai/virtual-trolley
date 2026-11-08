import { describe, expect, it } from 'vitest';
import { event, PRODUCTS } from '../testing/fakes';
import { Theme, drawScene } from './draw';
import { buildLayout } from './layout';
import { TrolleyView } from './models';
import { ShopScene } from './scene';
import { emptyWorld, reduceWorld } from './world';

const layout = buildLayout(PRODUCTS, ['cashier-1', 'cashier-2'], 5);
const theme: Theme = {
  bg: '#fff', surface: '#eee', fg: '#000', muted: '#888', line: '#ccc',
  accent: '#00f', ok: '#0a0', warn: '#fa0', bad: '#f00',
};

/** A canvas context that records what is drawn. jsdom has no real canvas, and we only need to know what was painted. */
function recordingContext() {
  const texts: string[] = [];
  const calls: string[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get: (target, prop: string) => {
      if (prop in target) {
        return target[prop];
      }
      return (...args: unknown[]) => {
        calls.push(prop);
        if (prop === 'fillText') {
          texts.push(String(args[0]));
        }
      };
    },
    set: (target, prop: string, value) => {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, calls };
}

function viewWith(events: ReturnType<typeof event>[], stock: [number, number][] = [], trolleys: TrolleyView[] = []) {
  const world = events.reduce(reduceWorld, emptyWorld());
  const scene = new ShopScene(layout);
  scene.sync(world);
  return { layout, avatars: scene.avatars.values(), world, products: PRODUCTS, stock: new Map(stock), trolleys };
}

describe('drawScene', () => {
  it('paints an empty shop without errors', () => {
    const { ctx, texts } = recordingContext();

    drawScene(ctx, viewWith([]), theme);

    expect(texts).toContain('CHECKOUT');
    expect(texts).toContain('ENTRANCE');
    expect(texts).toContain('EXIT');
    expect(texts).toContain('Till 1');
    expect(texts).toContain('Till 2');
  });

  it('labels every shelf with its product', () => {
    const { ctx, texts } = recordingContext();

    drawScene(ctx, viewWith([]), theme);

    for (const product of PRODUCTS) {
      expect(texts).toContain(product.name);
    }
  });

  it('shows stock levels, including sold out', () => {
    const { ctx, texts } = recordingContext();

    drawScene(ctx, viewWith([], [[1, 6], [2, 1], [3, 0]]), theme);

    expect(texts).toContain('6 left');
    expect(texts).toContain('1 left');
    expect(texts).toContain('sold out');
  });

  it('colours low and empty stock differently from healthy stock', () => {
    const fills = new Map<string, string>();
    const { ctx } = recordingContext();
    const proxied = new Proxy(ctx, {
      get: (target, prop: string) => {
        const value = (target as unknown as Record<string, unknown>)[prop];
        if (prop === 'fillText') {
          return (text: string) => {
            fills.set(text, String((target as unknown as Record<string, unknown>)['fillStyle']));
          };
        }
        return value;
      },
    });

    drawScene(proxied, viewWith([], [[1, 6], [2, 1], [3, 0]]), theme);

    expect(fills.get('6 left')).toBe(theme.ok);
    expect(fills.get('1 left')).toBe(theme.warn);
    expect(fills.get('sold out')).toBe(theme.bad);
  });

  it('shows the basket total on the counter screen once scanned', () => {
    const { ctx, texts } = recordingContext();
    const events = [
      event(1, 'TROLLEY_TAKEN', { trolleyId: 1 }, 'customer-1'),
      event(2, 'CUSTOMER_AT_TILL', {}, 'customer-1'),
      event(3, 'CART_SCANNED', { customerId: 'customer-1', items: [], itemCount: 3, totalCents: 123450 }, 'cashier-1'),
    ];

    drawScene(ctx, viewWith(events), theme);

    expect(texts).toContain('R1,234.50');
  });

  it('draws each customer with their number and their trolley count', () => {
    const { ctx, texts } = recordingContext();
    const trolleys: TrolleyView[] = [
      { id: 1, barcode: 'TRL-0001', state: 'IN_USE', owner: 'customer-7', itemCount: 4, totalCents: 0, totalGrams: 0 },
    ];

    drawScene(ctx, viewWith([event(1, 'TROLLEY_TAKEN', { trolleyId: 1 }, 'customer-7')], [], trolleys), theme);

    expect(texts).toContain('7');
    expect(texts).toContain('4');
  });
});
