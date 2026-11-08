import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { createFakes, event, PRODUCTS, snapshot, stats } from '../testing/fakes';
import { SimulationStore } from './simulation-store.service';

function setup(apiOverrides: Record<string, unknown> = {}) {
  const fakes = createFakes(apiOverrides);
  TestBed.configureTestingModule({ providers: fakes.providers });
  return { store: TestBed.inject(SimulationStore), ...fakes };
}

const taken = (seq: number, who = 'customer-1') => event(seq, 'TROLLEY_TAKEN', { trolleyId: 1 }, who);

describe('SimulationStore: the shop world', () => {
  it('folds streamed events into who-is-where', () => {
    const { store, events$ } = setup();

    events$.next([taken(1), event(2, 'CUSTOMER_AT_TILL', {}, 'customer-1')]);

    expect(store.world().customers['customer-1'].trolleyId).toBe(1);
    expect(store.world().queue).toEqual(['customer-1']);
  });

  it('clears the world when a run starts or is reset', () => {
    const { store, events$ } = setup();
    events$.next([taken(1)]);

    events$.next([event(2, 'SIMULATION_RESET', {}, 'system')]);

    expect(store.world().customers).toEqual({});
  });

  it('does not apply the same event to the world twice', () => {
    const { store, events$ } = setup();

    events$.next([taken(1), event(2, 'CUSTOMER_WALKING', { productId: 2, etaMs: 500 })]);
    events$.next([taken(1), event(2, 'CUSTOMER_WALKING', { productId: 2, etaMs: 500 })]);

    expect(store.world().customers['customer-1'].moveCount).toBe(2);
  });

  it('rebuilds the world from the snapshot history after a page refresh', () => {
    const { store, connection$ } = setup({
      state: () => of(snapshot({
        status: 'RUNNING', lastSeq: 3,
        recentEvents: [
          taken(1),
          event(2, 'CUSTOMER_AT_TILL', {}, 'customer-1'),
          event(3, 'CART_SCANNED', { customerId: 'customer-1', items: [], itemCount: 0, totalCents: 500 }, 'cashier-1'),
        ],
      })),
    });

    connection$.next('live');

    expect(store.world().cashiers['cashier-1'].status).toBe('scanning');
    expect(store.world().customers['customer-1']).toBeDefined();
  });
});

describe('SimulationStore: live numbers', () => {
  it('loads the catalogue when the socket becomes live', () => {
    const { store, api, connection$ } = setup();

    connection$.next('live');

    expect(api.products).toHaveBeenCalledOnce();
    expect(store.products().length).toBe(PRODUCTS.length);
  });

  it('shelves are full until the first state arrives, then follow the server', () => {
    const { store, connection$, state$ } = setup({ state: () => NEVER }); // catalogue loads, state has not arrived
    connection$.next('live');
    expect(store.stock().get(1)).toBe(6); // initialStock from the catalogue

    state$.next(snapshot({ status: 'RUNNING', stock: [{ productId: 1, available: 2 }, { productId: 2, available: 0 }] }));

    expect(store.stock().get(1)).toBe(2);
    expect(store.stock().get(2)).toBe(0);
  });

  it('exposes stats and trolleys from the latest state', () => {
    const { store, state$ } = setup();

    state$.next(snapshot({
      status: 'RUNNING',
      stats: stats({ salesCount: 3, revenueCents: 9900 }),
      trolleys: [1, 2, 3].map((id) => ({
        id, barcode: `TRL-000${id}`, state: 'AVAILABLE' as const, owner: null, itemCount: 0, totalCents: 0, totalGrams: 0,
      })),
    }));

    expect(store.stats().salesCount).toBe(3);
    expect(store.trolleys().length).toBe(3);
    expect(store.trolleyCount()).toBe(3);
  });

  it('falls back to sensible defaults before anything is known', () => {
    const { store } = setup();

    expect(store.trolleyCount()).toBe(5);
    expect(store.cashierNames()).toEqual(['cashier-1', 'cashier-2']);
    expect(store.stats().revenueCents).toBe(0);
  });

  it('takes the cashier names from the server', () => {
    const { store, state$ } = setup();

    state$.next(snapshot({
      stats: stats({ cashiers: ['cashier-1', 'cashier-2', 'cashier-3'].map((name) => ({ name, busyMs: 0, utilisationPct: 0 })) }),
    }));

    expect(store.cashierNames()).toEqual(['cashier-1', 'cashier-2', 'cashier-3']);
  });

  it('ignores a state broadcast that is older than the events already seen', () => {
    const { store, events$, state$ } = setup();
    events$.next([event(10, 'SIMULATION_FINISHED', {}, 'system')]);

    state$.next(snapshot({ status: 'RUNNING', lastSeq: 5 })); // stale: computed before event 10

    expect(store.status()).toBe('FINISHED');
  });

  it('adopts the status of a broadcast that is up to date', () => {
    const { store, events$, state$ } = setup();
    events$.next([event(10, 'SIMULATION_STARTED', {}, 'system')]);

    state$.next(snapshot({ status: 'PAUSED', lastSeq: 10 }));

    expect(store.status()).toBe('PAUSED');
  });
});
