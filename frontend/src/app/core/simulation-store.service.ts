import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, filter, switchMap } from 'rxjs';
import {
  Product, SequencedEvent, SimulationSnapshot, SimulationStatus, StatsView, StatusResponse,
} from './models';
import { SimulationApiService } from './simulation-api.service';
import { SimulationSocketService } from './simulation-socket.service';
import { DEFAULT_CASHIERS, ShopWorld, emptyWorld, reduceWorld, replay } from './world';

/** Cap on events kept in the browser, so a long run cannot grow memory without bound. */
export const MAX_EVENTS = 500;
const DEFAULT_TROLLEYS = 5;

const NO_STATS: StatsView = {
  revenueCents: 0, salesCount: 0, queueLength: 0, avgQueueWaitMs: 0, maxQueueWaitMs: 0,
  batchesCompleted: 0, lastBatchMs: 0, activeElapsedMs: 0, cashiers: [],
};

/**
 * Single source of truth for the UI.
 *
 * Two streams feed it:
 *  - events (/topic/events): what just happened; drives the log, the walking customers and the tills.
 *  - state  (/topic/state):  live numbers (trolleys, stock, stats), computed on the server.
 *
 * Catching up: on every (re)connect we load the server snapshot, then apply streamed events.
 * Each event carries a sequence number, so anything already covered by the snapshot is skipped.
 */
@Injectable({ providedIn: 'root' })
export class SimulationStore {
  private readonly api = inject(SimulationApiService);
  private readonly socket = inject(SimulationSocketService);

  // --- state (private writable signals, public read-only views) ---
  private readonly _events = signal<SequencedEvent[]>([]);
  private readonly _status = signal<SimulationStatus>('IDLE');
  private readonly _error = signal<string | null>(null);
  private readonly _products = signal<Product[]>([]);
  private readonly _state = signal<SimulationSnapshot | null>(null);
  private readonly _world = signal<ShopWorld>(emptyWorld());
  private lastSeq = 0;

  readonly events = this._events.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly products = this._products.asReadonly();
  readonly world = this._world.asReadonly();
  readonly connection = toSignal(this.socket.connection$, { initialValue: 'connecting' });

  // --- derived state ---
  readonly canStart = computed(() => this._status() === 'IDLE' || this._status() === 'FINISHED');
  readonly canPause = computed(() => this._status() === 'RUNNING');
  readonly canResume = computed(() => this._status() === 'PAUSED');
  readonly canReset = computed(() => this._status() !== 'IDLE');

  readonly stats = computed(() => this._state()?.stats ?? NO_STATS);
  readonly trolleys = computed(() => this._state()?.trolleys ?? []);
  readonly trolleyCount = computed(() => this.trolleys().length || DEFAULT_TROLLEYS);
  readonly cashierNames = computed(() => {
    const names = this.stats().cashiers.map((c) => c.name);
    return names.length > 0 ? names : DEFAULT_CASHIERS;
  });
  /** productId -> units on the shelf. Before the first state arrives, shelves are full. */
  readonly stock = computed(() => {
    const state = this._state();
    return state
      ? new Map(state.stock.map((s) => [s.productId, s.available] as const))
      : new Map(this._products().map((p) => [p.id, p.initialStock] as const));
  });

  constructor() {
    // What just happened: apply every batch as it arrives
    this.socket.events$
      .pipe(takeUntilDestroyed())
      .subscribe((batch) => this.applyBatch(batch));

    // Live numbers
    this.socket.state$
      .pipe(takeUntilDestroyed())
      .subscribe((state) => this.applyState(state));

    // Each time the socket becomes live, fetch the snapshot (covers page load AND reconnects)
    this.socket.connection$
      .pipe(
        filter((state) => state === 'live'),
        switchMap(() =>
          this.api.state().pipe(
            catchError(() => {
              this._error.set('Could not load the current state from the server');
              return EMPTY; // keep the stream alive for the next reconnect
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((snapshot) => this.applySnapshot(snapshot));

    // The catalogue drives the shop layout; it rarely changes, so loading it on connect is plenty
    this.socket.connection$
      .pipe(
        filter((state) => state === 'live'),
        switchMap(() => this.api.products().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe((products) => this._products.set(products));
  }

  // --- commands ---

  start(): void {
    this.run(this.api.start());
  }

  pause(): void {
    this.run(this.api.pause());
  }

  resume(): void {
    this.run(this.api.resume());
  }

  reset(): void {
    this.run(this.api.reset());
  }

  // --- state updates (public for tests; the UI never calls these) ---

  applyBatch(batch: SequencedEvent[]): void {
    const fresh = batch.filter((event) => event.seq > this.lastSeq);
    if (fresh.length === 0) {
      return;
    }

    let events = this._events();
    let world = this._world();
    for (const event of fresh) {
      // The server clears its history on start and reset; mirror that so both sides agree
      if (event.type === 'SIMULATION_STARTED' || event.type === 'SIMULATION_RESET') {
        events = [];
      }
      events = [...events, event];
      world = reduceWorld(world, event);
      const status = statusAfter(event);
      if (status) {
        this._status.set(status);
      }
      this.lastSeq = Math.max(this.lastSeq, event.seq);
    }
    this._events.set(events.slice(-MAX_EVENTS));
    this._world.set(world);
  }

  applySnapshot(snapshot: SimulationSnapshot): void {
    // Events that arrived over the socket before the snapshot did, and are newer than it
    const newer = this._events().filter((event) => event.seq > snapshot.lastSeq);
    const history = [...snapshot.recentEvents, ...newer];
    this._events.set(history.slice(-MAX_EVENTS));
    this._world.set(replay(history, this.cashierNamesFrom(snapshot)));
    this.lastSeq = Math.max(snapshot.lastSeq, ...newer.map((event) => event.seq));
    this._status.set(snapshot.status);
    this._state.set(snapshot);
    this._error.set(null);
  }

  /** Periodic live numbers. Their status is ignored when events have already moved past them. */
  applyState(state: SimulationSnapshot): void {
    this._state.set(state);
    if (state.lastSeq >= this.lastSeq) {
      this._status.set(state.status);
    }
  }

  // --- helpers ---

  private cashierNamesFrom(snapshot: SimulationSnapshot): string[] {
    const names = snapshot.stats.cashiers.map((c) => c.name);
    return names.length > 0 ? names : DEFAULT_CASHIERS;
  }

  private run(command: Observable<StatusResponse>): void {
    command.subscribe({
      next: (response) => {
        this._status.set(response.status); // instant feedback; the event stream confirms it
        this._error.set(null);
      },
      error: (err: unknown) => this._error.set(describe(err)),
    });
  }
}

/** Which status does a lifecycle event imply? Undefined for ordinary events. */
function statusAfter(event: SequencedEvent): SimulationStatus | undefined {
  switch (event.type) {
    case 'SIMULATION_STARTED':
    case 'SIMULATION_RESUMED':
      return 'RUNNING';
    case 'SIMULATION_PAUSED':
      return 'PAUSED';
    case 'SIMULATION_FINISHED':
      return 'FINISHED';
    case 'SIMULATION_RESET':
      return 'IDLE';
    default:
      return undefined;
  }
}

function describe(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    // 409 carries { error: "Cannot pause while IDLE" }; 0 means the server is unreachable
    return err.error?.error ?? (err.status === 0 ? 'Server unreachable' : `Request failed (${err.status})`);
  }
  return 'Unexpected error';
}
