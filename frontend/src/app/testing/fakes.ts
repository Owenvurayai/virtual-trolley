import { Provider } from '@angular/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { ConnectionState, SequencedEvent, SimulationSnapshot } from '../core/models';
import { SimulationApiService } from '../core/simulation-api.service';
import { SimulationSocketService } from '../core/simulation-socket.service';

/** Test helper: a minimal event. Only seq and type usually matter. */
export function event(seq: number, type: SequencedEvent['type'] = 'ITEM_ADDED'): SequencedEvent {
  return { seq, type, actor: 'customer-1', message: `message ${seq}`, at: 1_700_000_000_000 + seq };
}

export function snapshot(overrides: Partial<SimulationSnapshot> = {}): SimulationSnapshot {
  return {
    status: 'IDLE', lastSeq: 0, trolleys: [], stock: [],
    stats: { revenueCents: 0, salesCount: 0, queueLength: 0 }, recentEvents: [], ...overrides,
  };
}

/**
 * Replaces the real HTTP and WebSocket services with controllable fakes,
 * so tests never touch the network. Push events with events$.next([...]).
 */
export function createFakes(apiOverrides: Record<string, unknown> = {}) {
  const events$ = new Subject<SequencedEvent[]>();
  const connection$ = new Subject<ConnectionState>();

  const api = {
    start: vi.fn(() => of({ status: 'RUNNING' })),
    pause: vi.fn(() => of({ status: 'PAUSED' })),
    resume: vi.fn(() => of({ status: 'RUNNING' })),
    reset: vi.fn(() => of({ status: 'IDLE' })),
    state: vi.fn(() => of(snapshot())),
    ...apiOverrides,
  };

  const providers: Provider[] = [
    { provide: SimulationApiService, useValue: api },
    {
      provide: SimulationSocketService,
      useValue: { events$: events$.asObservable(), connection$: connection$.asObservable() },
    },
  ];

  return { events$, connection$, api, providers };
}
