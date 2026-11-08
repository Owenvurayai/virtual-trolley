import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TrolleyView } from '../../core/models';
import { createFakes, snapshot, stats } from '../../testing/fakes';
import { StatsPanel } from './stats-panel';

function trolley(id: number, state: TrolleyView['state']): TrolleyView {
  return { id, barcode: `TRL-000${id}`, state, owner: null, itemCount: 0, totalCents: 0, totalGrams: 0 };
}

function setup() {
  const fakes = createFakes();
  TestBed.configureTestingModule({ imports: [StatsPanel], providers: fakes.providers });
  const fixture = TestBed.createComponent(StatsPanel);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  /** The value shown on the card with this label. */
  const card = (label: string) => {
    const el = Array.from(root.querySelectorAll('.card')).find((c) => c.querySelector('.label')?.textContent?.trim() === label);
    return el?.querySelector('.value')?.textContent?.replace(/\s+/g, ' ').trim();
  };
  return { fixture, root, card, ...fakes };
}

describe('StatsPanel', () => {
  it('starts at zero before any run', () => {
    const { card, root } = setup();

    expect(card('Revenue')).toBe('R0.00');
    expect(card('Sales')).toBe('0');
    expect(card('In queue')).toBe('0');
    expect(root.querySelector('.bars')).toBeNull(); // no cashiers reported yet
  });

  it('shows the live numbers pushed by the server', () => {
    const { fixture, card, state$ } = setup();

    state$.next(snapshot({
      status: 'RUNNING',
      trolleys: [trolley(1, 'IN_USE'), trolley(2, 'AT_CHECKOUT'), trolley(3, 'AVAILABLE'), trolley(4, 'AVAILABLE'), trolley(5, 'AVAILABLE')],
      stats: stats({
        revenueCents: 123450, salesCount: 4, queueLength: 2, avgQueueWaitMs: 2400, maxQueueWaitMs: 5100,
        batchesCompleted: 1, lastBatchMs: 7300, activeElapsedMs: 75_000,
      }),
    }));
    fixture.detectChanges();

    expect(card('Revenue')).toBe('R1,234.50');
    expect(card('Sales')).toBe('4');
    expect(card('In queue')).toBe('2');
    expect(card('Shoppers in store')).toBe('2');
    expect(card('Trolleys free')).toBe('3 / 5');
    expect(card('Avg queue wait')).toBe('2.4 s');
    expect(card('Longest wait')).toBe('5.1 s');
    expect(card('Batches done')).toContain('1');
    expect(card('Batches done')).toContain('last 7.3 s');
    expect(card('Run time')).toBe('1:15');
  });

  it('draws a utilisation bar for each cashier', () => {
    const { fixture, root, state$ } = setup();

    state$.next(snapshot({
      status: 'RUNNING',
      stats: stats({ cashiers: [
        { name: 'cashier-1', busyMs: 6000, utilisationPct: 60 },
        { name: 'cashier-2', busyMs: 3500, utilisationPct: 35 },
      ] }),
    }));
    fixture.detectChanges();

    const rows = Array.from(root.querySelectorAll('.bars li'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('cashier-1');
    expect(rows[0].textContent).toContain('60%');
    expect((rows[0].querySelector('.fill') as HTMLElement).style.width).toBe('60%');
    expect(rows[1].querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('35');
  });

  it('shows a dash for the last batch until one has finished', () => {
    const { fixture, card, state$ } = setup();

    state$.next(snapshot({ status: 'RUNNING', stats: stats({ batchesCompleted: 0 }) }));
    fixture.detectChanges();

    expect(card('Batches done')).toContain('last -');
  });
});
