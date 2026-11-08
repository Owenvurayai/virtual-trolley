import { beforeEach, describe, expect, it } from 'vitest';
import { event, PRODUCTS } from '../testing/fakes';
import { buildLayout } from './layout';
import { ShopScene } from './scene';
import { emptyWorld, reduceWorld, ShopWorld } from './world';

const layout = buildLayout(PRODUCTS, ['cashier-1', 'cashier-2'], 5);

const taken = (seq: number, who = 'customer-1', trolleyId = 1) => event(seq, 'TROLLEY_TAKEN', { trolleyId }, who);
const walking = (seq: number, productId: number, etaMs: number, who = 'customer-1') =>
  event(seq, 'CUSTOMER_WALKING', { productId, etaMs }, who);
const atTill = (seq: number, who: string) => event(seq, 'CUSTOMER_AT_TILL', { ahead: 0 }, who);
const scan = (seq: number, cashier: string, customer: string) =>
  event(seq, 'CART_SCANNED', { customerId: customer, items: [], itemCount: 0, totalCents: 0 }, cashier);

describe('ShopScene', () => {
  let scene: ShopScene;
  let world: ShopWorld;

  /** Feeds one event through the world and tells the scene, as the app does. */
  const feed = (...events: ReturnType<typeof event>[]) => {
    for (const e of events) {
      world = reduceWorld(world, e);
    }
    scene.sync(world);
  };
  const avatar = (id: string) => scene.avatars.get(id)!;
  const distance = (id: string, p: { x: number; y: number }) => Math.hypot(avatar(id).x - p.x, avatar(id).y - p.y);

  beforeEach(() => {
    scene = new ShopScene(layout);
    world = emptyWorld();
  });

  it('a customer appears at the trolley rack', () => {
    feed(taken(1, 'customer-1', 3));

    expect(scene.avatars.size).toBe(1);
    expect(distance('customer-1', layout.rack[2])).toBe(0);
  });

  it('walks to the shelf and arrives when the backend said the walk would end', () => {
    feed(taken(1));
    feed(walking(2, 5, 2000));
    const stand = layout.standPoint(5)!;

    scene.step(1000);
    expect(distance('customer-1', stand)).toBeGreaterThan(20); // halfway: not there yet

    scene.step(1100);
    expect(distance('customer-1', stand)).toBeLessThan(12); // within the jitter that keeps customers apart
  });

  it('turns to face the direction it is walking', () => {
    feed(taken(1));
    feed(walking(2, 1, 5000));

    scene.step(100);

    expect(Number.isFinite(avatar('customer-1').heading)).toBe(true);
    expect(avatar('customer-1').heading).not.toBe(-Math.PI / 2); // no longer the spawn heading
  });

  it('syncing the same world twice does not queue the same walk twice', () => {
    feed(taken(1));
    feed(walking(2, 5, 1000));
    const waypoints = avatar('customer-1').waypoints.length;

    scene.sync(world);
    scene.sync(world);

    expect(avatar('customer-1').waypoints.length).toBe(waypoints);
  });

  it('after a page refresh customers appear where they are, not at the door', () => {
    world = [taken(1), atTill(2, 'customer-1'), scan(3, 'cashier-2', 'customer-1')].reduce(reduceWorld, world);

    scene.sync(world); // brand new scene, history already folded into the world

    expect(distance('customer-1', layout.tills[1].service)).toBeLessThan(0.01);
    expect(avatar('customer-1').waypoints.length).toBe(0);
  });

  it('queued customers take their places in order and shuffle forward when one is served', () => {
    feed(taken(1, 'customer-1', 1), taken(2, 'customer-2', 2));
    feed(atTill(3, 'customer-1'), atTill(4, 'customer-2'));
    scene.step(60_000);

    expect(distance('customer-1', layout.queue[0])).toBeLessThan(0.01);
    expect(distance('customer-2', layout.queue[1])).toBeLessThan(0.01);

    feed(scan(5, 'cashier-1', 'customer-1'));
    scene.step(60_000);

    expect(distance('customer-1', layout.tills[0].service)).toBeLessThan(0.01);
    expect(distance('customer-2', layout.queue[0])).toBeLessThan(0.01); // moved up
  });

  it('a customer who is paid up walks to the exit and then disappears', () => {
    feed(taken(1));
    feed(event(2, 'TROLLEY_RESET', { trolleyId: 1 }, 'customer-1'));
    expect(scene.avatars.has('customer-1')).toBe(true); // still walking out

    scene.step(120_000);

    expect(scene.avatars.has('customer-1')).toBe(false);
  });

  it('removes everyone when the run is reset', () => {
    feed(taken(1), taken(2, 'customer-2', 2));
    expect(scene.avatars.size).toBe(2);

    feed(event(9, 'SIMULATION_RESET', {}, 'system'));

    expect(scene.avatars.size).toBe(0);
  });

  it('catches up when events arrive faster than customers can walk', () => {
    feed(taken(1));
    for (let i = 0; i < 12; i++) {
      feed(walking(i + 2, (i % 12) + 1, 100)); // twelve long walks announced in a burst
    }
    const before = avatar('customer-1').waypoints.length;

    scene.step(500);

    // With the rubber band it works through noticeably more than a 500 ms walk would allow
    expect(avatar('customer-1').waypoints.length).toBeLessThan(before - 2);
  });
});
