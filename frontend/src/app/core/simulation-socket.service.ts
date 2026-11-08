import { Injectable, OnDestroy } from '@angular/core';
import { RxStomp, RxStompState } from '@stomp/rx-stomp';
import { Observable, map } from 'rxjs';
import { ConnectionState, SequencedEvent, SimulationSnapshot } from './models';

/**
 * Owns the single WebSocket connection and exposes it as two RxJS streams.
 * RxStomp reconnects automatically and re-subscribes after a reconnect.
 */
@Injectable({ providedIn: 'root' })
export class SimulationSocketService implements OnDestroy {
  private readonly stomp = new RxStomp();

  /** Each message from the server is a batch (array) of events, throttled server-side to ~20/s. */
  readonly events$: Observable<SequencedEvent[]> = this.stomp
    .watch('/topic/events')
    .pipe(map((message) => JSON.parse(message.body) as SequencedEvent[]));

  /** Live numbers (trolleys, stock, stats), pushed about twice a second while a run is active. */
  readonly state$: Observable<SimulationSnapshot> = this.stomp
    .watch('/topic/state')
    .pipe(map((message) => JSON.parse(message.body) as SimulationSnapshot));

  readonly connection$: Observable<ConnectionState> = this.stomp.connectionState$.pipe(
    map((state): ConnectionState => {
      switch (state) {
        case RxStompState.OPEN:
          return 'live';
        case RxStompState.CONNECTING:
          return 'connecting';
        default:
          return 'disconnected';
      }
    }),
  );

  constructor() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    this.stomp.configure({
      // Same host as the page: in dev the proxy forwards /ws to Spring Boot
      brokerURL: `${scheme}://${location.host}/ws`,
      reconnectDelay: 2000,
    });
    this.stomp.activate();
  }

  ngOnDestroy(): void {
    void this.stomp.deactivate();
  }
}
