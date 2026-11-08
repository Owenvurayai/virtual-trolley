import { Provider } from '@angular/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import {
  ConnectionState, Product, SequencedEvent, SimulationSnapshot, StatsView,
} from '../core/models';
import { SimulationApiService } from '../core/simulation-api.service';
import { SimulationSocketService } from '../core/simulation-socket.service';

/** Test helper: a minimal event. Only seq and type usually matter. */
export function event(
  seq: number,
  type: SequencedEvent['type'] = 'ITEM_ADDED',
  data: Record<string, unknown> = {},
  actor = 'customer-1',
): SequencedEvent {
  return { seq, type, actor, message: `message ${seq}`, at: 1_700_000_000_000 + seq, data };
}

export function stats(overrides: Partial<StatsView> = {}): StatsView {
  return {
    revenueCents: 0, salesCount: 0, queueLength: 0, avgQueueWaitMs: 0, maxQueueWaitMs: 0,
    batchesCompleted: 0, lastBatchMs: 0, activeElapsedMs: 0, cashiers: [], ...overrides,
  };
}

export function snapshot(overrides: Partial<SimulationSnapshot> = {}): SimulationSnapshot {
  return {
    status: 'IDLE', lastSeq: 0, trolleys: [], stock: [], stats: stats(), recentEvents: [], ...overrides,
  };
}

/** Twelve products, like the backend demo catalogue. */
export const PRODUCTS: Product[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1, name: `Product ${i + 1}`, priceCents: 1000 * (i + 1), weightGrams: 500, initialStock: 6,
}));

/**
 * Replaces the real HTTP and WebSocket services with controllable fakes,
 * so tests never touch the network. Push data with events$.next([...]) and state$.next(...).
 */
export function createFakes(apiOverrides: Record<string, unknown> = {}) {
  const events$ = new Subject<SequencedEvent[]>();
  const state$ = new Subject<SimulationSnapshot>();
  const connection$ = new Subject<ConnectionState>();

  const api = {
    start: vi.fn(() => of({ status: 'RUNNING' })),
    pause: vi.fn(() => of({ status: 'PAUSED' })),
    resume: vi.fn(() => of({ status: 'RUNNING' })),
    reset: vi.fn(() => of({ status: 'IDLE' })),
    state: vi.fn(() => of(snapshot())),
    products: vi.fn(() => of(PRODUCTS)),
    ...apiOverrides,
  };

  const providers: Provider[] = [
    { provide: SimulationApiService, useValue: api },
    {
      provide: SimulationSocketService,
      useValue: {
        events$: events$.asObservable(),
        state$: state$.asObservable(),
        connection$: connection$.asObservable(),
      },
    },
  ];

  return { events$, state$, connection$, api, providers };
}
