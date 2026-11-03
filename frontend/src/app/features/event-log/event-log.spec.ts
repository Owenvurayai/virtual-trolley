import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { createFakes, event } from '../../testing/fakes';
import { EventLog } from './event-log';

function setup() {
  const fakes = createFakes();
  TestBed.configureTestingModule({ imports: [EventLog], providers: fakes.providers });
  const fixture = TestBed.createComponent(EventLog);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const rows = () => root.querySelectorAll('.row');
  const chip = (label: string) =>
    Array.from(root.querySelectorAll('.chip')).find((c) => c.textContent?.trim() === label) as HTMLElement;
  return { fixture, root, rows, chip, ...fakes };
}

describe('EventLog', () => {
  it('shows a hint when there are no events', () => {
    const { root, rows } = setup();

    expect(rows().length).toBe(0);
    expect(root.querySelector('.empty')?.textContent).toContain('Press Start');
  });

  it('renders one row per event with type, actor and message', () => {
    const { fixture, rows, events$ } = setup();

    events$.next([event(1, 'ITEM_ADDED'), event(2, 'PAYMENT_OK')]);
    fixture.detectChanges();

    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('ITEM_ADDED');
    expect(rows()[0].textContent).toContain('customer-1');
    expect(rows()[0].textContent).toContain('message 1');
  });

  it('filters by category', () => {
    const { fixture, root, rows, chip, events$ } = setup();
    events$.next([event(1, 'ITEM_ADDED'), event(2, 'PAYMENT_OK'), event(3, 'BATCH_STARTED')]);
    fixture.detectChanges();

    chip('checkout').click();
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('PAYMENT_OK');
    expect(root.querySelector('.meta')?.textContent).toContain('1 / 3 events');

    chip('all').click();
    fixture.detectChanges();
    expect(rows().length).toBe(3);
  });

  it('flags failures with the warning style', () => {
    const { fixture, rows, events$ } = setup();

    events$.next([event(1, 'PAYMENT_FAILED')]);
    fixture.detectChanges();

    expect(rows()[0].getAttribute('data-cat')).toBe('warn');
  });
});
