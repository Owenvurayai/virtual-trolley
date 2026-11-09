import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createFakes, event, snapshot } from '../testing/fakes';
import { ERROR_VISIBLE_MS, MAX_EVENTS, SimulationStore } from './simulation-store.service';

function setup(apiOverrides: Record<string, unknown> = {}) {
  const fakes = createFakes(apiOverrides);
  TestBed.configureTestingModule({ providers: fakes.providers });
  return { store: TestBed.inject(SimulationStore), ...fakes };
}

describe('SimulationStore', () => {
  describe('streamed events', () => {
    it('appends new events in order', () => {
      const { store, events$ } = setup();

      events$.next([event(1), event(2)]);
      events$.next([event(3)]);

      expect(store.events().map((e) => e.seq)).toEqual([1, 2, 3]);
    });

    it('ignores duplicates and anything older than what it already has', () => {
      const { store, events$ } = setup();
      events$.next([event(1), event(2), event(3)]);

      events$.next([event(2), event(3), event(4)]);

      expect(store.events().map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    });

    it('keeps only the newest MAX_EVENTS', () => {
      const { store, events$ } = setup();

      events$.next(Array.from({ length: MAX_EVENTS + 50 }, (_, i) => event(i + 1)));

      expect(store.events().length).toBe(MAX_EVENTS);
      expect(store.events()[0].seq).toBe(51);
    });
  });

  describe('lifecycle events', () => {
    it('drive the status', () => {
      const { store, events$ } = setup();

      events$.next([event(1, 'SIMULATION_STARTED')]);
      expect(store.status()).toBe('RUNNING');
      events$.next([event(2, 'SIMULATION_PAUSED')]);
      expect(store.status()).toBe('PAUSED');
      events$.next([event(3, 'SIMULATION_RESUMED')]);
      expect(store.status()).toBe('RUNNING');
      events$.next([event(4, 'SIMULATION_FINISHED')]);
      expect(store.status()).toBe('FINISHED');
    });

    it('clear the log on start and on reset, as the server does', () => {
      const { store, events$ } = setup();
      events$.next([event(1), event(2), event(3)]);

      events$.next([event(4, 'SIMULATION_STARTED'), event(5)]);
      expect(store.events().map((e) => e.seq)).toEqual([4, 5]);

      events$.next([event(6, 'SIMULATION_RESET')]);
      expect(store.events().map((e) => e.seq)).toEqual([6]);
      expect(store.status()).toBe('IDLE');
    });
  });

  describe('catching up with the server snapshot', () => {
    it('loads the snapshot when the socket becomes live', () => {
      const { store, connection$ } = setup({
        state: () => of(snapshot({ status: 'RUNNING', lastSeq: 11, recentEvents: [event(10), event(11)] })),
      });

      connection$.next('live');

      expect(store.status()).toBe('RUNNING');
      expect(store.events().map((e) => e.seq)).toEqual([10, 11]);
    });

    it('keeps streamed events newer than the snapshot and drops the overlap', () => {
      const { store, events$, connection$ } = setup({
        state: () => of(snapshot({ lastSeq: 11, recentEvents: [event(10), event(11)] })),
      });
      events$.next([event(11), event(12)]); // arrived before the snapshot did

      connection$.next('live');

      expect(store.events().map((e) => e.seq)).toEqual([10, 11, 12]);
    });

    it('ignores streamed events the snapshot already covers', () => {
      const { store, events$, connection$ } = setup({
        state: () => of(snapshot({ lastSeq: 20, recentEvents: [event(19), event(20)] })),
      });
      connection$.next('live');

      events$.next([event(18), event(20), event(21)]);

      expect(store.events().map((e) => e.seq)).toEqual([19, 20, 21]);
    });

    it('survives a failed snapshot request and recovers on the next reconnect', () => {
      let calls = 0;
      const { store, connection$ } = setup({
        state: () => (++calls === 1
          ? throwError(() => new HttpErrorResponse({ status: 0 }))
          : of(snapshot({ status: 'PAUSED' }))),
      });

      connection$.next('live');
      expect(store.error()).toContain('Could not load');

      connection$.next('disconnected');
      connection$.next('live');
      expect(store.status()).toBe('PAUSED');
      expect(store.error()).toBeNull();
    });
  });

  describe('commands', () => {
    it('start() updates the status immediately from the response', () => {
      const { store, api } = setup();

      store.start();

      expect(api.start).toHaveBeenCalledOnce();
      expect(store.status()).toBe('RUNNING');
    });

    it('shows the server message when a command is rejected with 409', () => {
      const { store } = setup({
        pause: () => throwError(() => new HttpErrorResponse({ status: 409, error: { error: 'Cannot pause while IDLE' } })),
      });

      store.pause();

      expect(store.error()).toBe('Cannot pause while IDLE');
      expect(store.status()).toBe('IDLE');
    });

    it('lets an error disappear by itself, so an idle screen never keeps a stale one', () => {
      vi.useFakeTimers();
      try {
        const { store } = setup({ start: () => throwError(() => new HttpErrorResponse({ status: 0 })) });

        store.start();
        expect(store.error()).toBe('Server unreachable');

        vi.advanceTimersByTime(ERROR_VISIBLE_MS - 1);
        expect(store.error()).toBe('Server unreachable');
        vi.advanceTimersByTime(1);
        expect(store.error()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('restarts the countdown when a newer error replaces an older one', () => {
      vi.useFakeTimers();
      try {
        const { store } = setup({
          start: () => throwError(() => new HttpErrorResponse({ status: 0 })),
          pause: () => throwError(() => new HttpErrorResponse({ status: 409, error: { error: 'Cannot pause while IDLE' } })),
        });

        store.start();
        vi.advanceTimersByTime(ERROR_VISIBLE_MS - 1000);
        store.pause();
        vi.advanceTimersByTime(ERROR_VISIBLE_MS - 1000); // the first timer would have fired by now
        expect(store.error()).toBe('Cannot pause while IDLE');

        vi.advanceTimersByTime(1000);
        expect(store.error()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('reports an unreachable server', () => {
      const { store } = setup({
        start: () => throwError(() => new HttpErrorResponse({ status: 0 })),
      });

      store.start();

      expect(store.error()).toBe('Server unreachable');
    });
  });

  describe('which buttons are enabled', () => {
    it.each([
      ['IDLE', { start: true, pause: false, resume: false, reset: false }],
      ['RUNNING', { start: false, pause: true, resume: false, reset: true }],
      ['PAUSED', { start: false, pause: false, resume: true, reset: true }],
      ['FINISHED', { start: true, pause: false, resume: false, reset: true }],
    ] as const)('in %s', (status, expected) => {
      const { store, connection$ } = setup({ state: () => of(snapshot({ status })) });

      connection$.next('live');

      expect({
        start: store.canStart(), pause: store.canPause(),
        resume: store.canResume(), reset: store.canReset(),
      }).toEqual(expected);
    });
  });
});
