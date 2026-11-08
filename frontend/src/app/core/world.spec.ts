import { describe, expect, it } from 'vitest';
import { event } from '../testing/fakes';
import { emptyWorld, reduceWorld, replay, ShopWorld } from './world';

const apply = (events: ReturnType<typeof event>[]): ShopWorld => events.reduce(reduceWorld, emptyWorld());

const taken = (seq: number, who = 'customer-1', trolleyId = 1) => event(seq, 'TROLLEY_TAKEN', { trolleyId }, who);
const walking = (seq: number, productId: number, etaMs = 800, who = 'customer-1') =>
  event(seq, 'CUSTOMER_WALKING', { productId, etaMs }, who);
const atTill = (seq: number, who = 'customer-1') => event(seq, 'CUSTOMER_AT_TILL', { trolleyId: 1, ahead: 0 }, who);
const scan = (seq: number, cashier: string, customer: string) =>
  event(seq, 'CART_SCANNED', {
    customerId: customer, trolleyId: 1, barcode: 'TRL-0001',
    items: [{ productId: 1, name: 'Rice 10kg', quantity: 2, lineCents: 37998 }],
    itemCount: 2, totalCents: 37998, totalGrams: 20000, waitMs: 1500,
  }, cashier);

describe('reduceWorld', () => {
  it('a customer taking a trolley starts at the trolley rack', () => {
    const world = apply([taken(1, 'customer-3', 3)]);

    expect(world.customers['customer-3'].trolleyId).toBe(3);
    expect(world.customers['customer-3'].moves).toEqual([{ place: { kind: 'rack' } }]);
  });

  it('walking is recorded with the announced duration', () => {
    const world = apply([taken(1), walking(2, 5, 1200)]);

    expect(world.customers['customer-1'].moves.at(-1)).toEqual({
      place: { kind: 'shelf', productId: 5 }, etaMs: 1200,
    });
  });

  it('ignores walking without a product, and events for customers it never saw', () => {
    const world = apply([taken(1), event(2, 'CUSTOMER_WALKING', {}, 'customer-1'), walking(3, 4, 500, 'customer-9')]);

    expect(world.customers['customer-1'].moveCount).toBe(1);
    expect(world.customers['customer-9']).toBeUndefined();
  });

  it('customers join the queue in order, once each', () => {
    const world = apply([taken(1), taken(2, 'customer-2', 2), atTill(3, 'customer-2'), atTill(4, 'customer-1'), atTill(5, 'customer-2')]);

    expect(world.queue).toEqual(['customer-1', 'customer-2']);
  });

  it('a scan moves the customer from the queue to the till and fills the cashier screen', () => {
    const world = apply([taken(1), atTill(2), scan(3, 'cashier-2', 'customer-1')]);

    expect(world.queue).toEqual([]);
    expect(world.customers['customer-1'].moves.at(-1)?.place).toEqual({ kind: 'till', cashier: 'cashier-2' });
    const till = world.cashiers['cashier-2'];
    expect(till.status).toBe('scanning');
    expect(till.customer).toBe('customer-1');
    expect(till.cart).toMatchObject({
      barcode: 'TRL-0001', itemCount: 2, totalCents: 37998, totalGrams: 20000, waitMs: 1500,
      items: [{ productId: 1, name: 'Rice 10kg', quantity: 2, lineCents: 37998 }],
    });
    expect(world.cashiers['cashier-1'].status).toBe('idle');
  });

  it('payment marks the till paid and the receipt is kept as printed', () => {
    const world = apply([
      taken(1), atTill(2), scan(3, 'cashier-1', 'customer-1'),
      event(4, 'PAYMENT_OK', { customerId: 'customer-1', totalCents: 37998, method: 'CARD' }, 'cashier-1'),
      event(5, 'RECEIPT_PRINTED', { customerId: 'customer-1', receiptNumber: 7, totalCents: 37998, method: 'CARD' }, 'cashier-1'),
    ]);

    expect(world.cashiers['cashier-1'].status).toBe('paid');
    expect(world.cashiers['cashier-1'].receipt).toMatchObject({ number: 7, customerId: 'customer-1', method: 'CARD', totalCents: 37998 });
    expect(world.cashiers['cashier-1'].receipt?.text).toBe('message 5');
  });

  it('a declined payment keeps the reason', () => {
    const world = apply([
      taken(1), atTill(2), scan(3, 'cashier-1', 'customer-1'),
      event(4, 'PAYMENT_FAILED', { customerId: 'customer-1', reason: 'Card declined' }, 'cashier-1'),
    ]);

    expect(world.cashiers['cashier-1']).toMatchObject({ status: 'declined', declineReason: 'Card declined' });
  });

  it('when the trolley is returned the customer leaves and the till frees up', () => {
    const world = apply([
      taken(1), atTill(2), scan(3, 'cashier-1', 'customer-1'),
      event(4, 'PAYMENT_OK', { customerId: 'customer-1', totalCents: 1, method: 'CARD' }, 'cashier-1'),
      event(5, 'TROLLEY_RESET', { trolleyId: 1 }, 'customer-1'),
    ]);

    expect(world.customers['customer-1'].moves.at(-1)?.place).toEqual({ kind: 'exit' });
    expect(world.cashiers['cashier-1']).toMatchObject({ status: 'idle', customer: null, cart: null });
  });

  it('a customer abandoning the queue leaves it', () => {
    const world = apply([taken(1), atTill(2), event(3, 'TROLLEY_RESET', { trolleyId: 1 }, 'customer-1')]);

    expect(world.queue).toEqual([]);
  });

  it('a closing cashier shows as closed', () => {
    expect(apply([event(1, 'CASHIER_CLOSED', {}, 'cashier-2')]).cashiers['cashier-2'].status).toBe('closed');
  });

  it('start and reset clear the shop but keep the cashier names', () => {
    const busy = apply([taken(1), atTill(2), scan(3, 'cashier-1', 'customer-1')]);

    for (const type of ['SIMULATION_STARTED', 'SIMULATION_RESET'] as const) {
      const cleared = reduceWorld(busy, event(9, type, {}, 'system'));
      expect(cleared.customers).toEqual({});
      expect(cleared.queue).toEqual([]);
      expect(cleared.cashierOrder).toEqual(['cashier-1', 'cashier-2']);
      expect(cleared.cashiers['cashier-1'].status).toBe('idle');
    }
  });

  it('never mutates the world it was given', () => {
    const before = apply([taken(1)]);
    const snapshot = structuredClone(before);

    reduceWorld(before, atTill(2));
    reduceWorld(before, walking(3, 2));

    expect(before).toEqual(snapshot);
  });

  it('keeps only recent moves but keeps counting them', () => {
    const world = apply([taken(1), ...Array.from({ length: 40 }, (_, i) => walking(i + 2, (i % 12) + 1))]);

    expect(world.customers['customer-1'].moves.length).toBe(24);
    expect(world.customers['customer-1'].moveCount).toBe(41);
  });

  it('replay gives the same world as applying events one by one', () => {
    const events = [taken(1), walking(2, 3), atTill(3), scan(4, 'cashier-1', 'customer-1')];

    expect(replay(events)).toEqual(apply(events));
  });
});
