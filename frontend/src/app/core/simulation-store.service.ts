import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, filter, switchMap } from 'rxjs';
import { SequencedEvent, SimulationSnapshot, SimulationStatus, StatusResponse } from './models';
import { SimulationApiService } from './simulation-api.service';
import { SimulationSocketService } from './simulation-socket.service';

/** Cap on events kept in the browser, so a long run cannot grow memory without bound. */
export const MAX_EVENTS = 500;

/**
 * Single source of truth for the UI.
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
  private lastSeq = 0;

  readonly events = this._events.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly connection = toSignal(this.socket.connection$, { initialValue: 'connecting' });

  // --- derived state: which buttons make sense right now ---
  readonly canStart = computed(() => this._status() === 'IDLE' || this._status() === 'FINISHED');
  readonly canPause = computed(() => this._status() === 'RUNNING');
  readonly canResume = computed(() => this._status() === 'PAUSED');
  readonly canReset = computed(() => this._status() !== 'IDLE');

  constructor() {
    // Live stream: apply every batch as it arrives
    this.socket.events$
      .pipe(takeUntilDestroyed())
      .subscribe((batch) => this.applyBatch(batch));

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
    for (const event of fresh) {
      // The server clears its history on start and reset; mirror that so both sides agree
      if (event.type === 'SIMULATION_STARTED' || event.type === 'SIMULATION_RESET') {
        events = [];
      }
      events = [...events, event];
      const status = statusAfter(event);
      if (status) {
        this._status.set(status);
      }
      this.lastSeq = Math.max(this.lastSeq, event.seq);
    }
    this._events.set(events.slice(-MAX_EVENTS));
  }

  applySnapshot(snapshot: SimulationSnapshot): void {
    // Events that arrived over the socket before the snapshot did, and are newer than it
    const newer = this._events().filter((event) => event.seq > snapshot.lastSeq);
    this._events.set([...snapshot.recentEvents, ...newer].slice(-MAX_EVENTS));
    this.lastSeq = Math.max(snapshot.lastSeq, ...newer.map((event) => event.seq));
    this._status.set(snapshot.status);
    this._error.set(null);
  }

  // --- helpers ---

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
