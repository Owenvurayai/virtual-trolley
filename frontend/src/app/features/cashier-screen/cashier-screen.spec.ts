import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { createFakes, event } from '../../testing/fakes';
import { CashierScreen } from './cashier-screen';

function setup() {
  const fakes = createFakes();
  TestBed.configureTestingModule({ imports: [CashierScreen], providers: fakes.providers });
  const fixture = TestBed.createComponent(CashierScreen);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const till = (n: number) => root.querySelectorAll('section.till')[n - 1] as HTMLElement;
  return { fixture, root, till, ...fakes };
}

const scanned = (seq: number, cashier = 'cashier-1') =>
  event(seq, 'CART_SCANNED', {
    customerId: 'customer-4', trolleyId: 4, barcode: 'TRL-0004',
    items: [
      { productId: 1, name: 'Rice 10kg', quantity: 2, lineCents: 37998 },
      { productId: 9, name: 'Brown Bread', quantity: 1, lineCents: 1799 },
    ],
    itemCount: 3, totalCents: 39797, totalGrams: 20700, waitMs: 900,
  }, cashier);

const arrive = (seq: number) => [
  event(seq, 'TROLLEY_TAKEN', { trolleyId: 4 }, 'customer-4'),
  event(seq + 1, 'CUSTOMER_AT_TILL', {}, 'customer-4'),
];

describe('CashierScreen', () => {
  it('shows one screen per cashier, waiting for a customer', () => {
    const { root, till } = setup();

    expect(root.querySelectorAll('section.till').length).toBe(2);
    expect(till(1).querySelector('h2')?.textContent).toContain('Till 1');
    expect(till(1).textContent).toContain('Waiting for next customer');
    expect(till(1).querySelector('.idle')?.textContent).toContain('No basket on screen');
  });

  it('the whole basket appears at once when the trolley is scanned', () => {
    const { fixture, till, events$ } = setup();

    events$.next([...arrive(1), scanned(3)]);
    fixture.detectChanges();

    const text = till(1).textContent ?? '';
    expect(text).toContain('customer-4');
    expect(text).toContain('TRL-0004');
    expect(text).toContain('Rice 10kg');
    expect(text).toContain('Brown Bread');
    expect(text).toContain('R379.98');
    expect(text).toContain('3 items');
    expect(text).toContain('20.7 kg');
    expect(text).toContain('R397.97');
    expect(till(1).querySelectorAll('tbody tr').length).toBe(2);
    expect(till(1).getAttribute('data-status')).toBe('scanning');
    expect(till(2).getAttribute('data-status')).toBe('idle'); // the other till is untouched
  });

  it('shows the printed receipt after payment', () => {
    const { fixture, till, events$ } = setup();

    events$.next([
      ...arrive(1), scanned(3),
      event(4, 'PAYMENT_OK', { customerId: 'customer-4', totalCents: 39797, method: 'CARD' }, 'cashier-1'),
      event(5, 'RECEIPT_PRINTED', { customerId: 'customer-4', receiptNumber: 12, totalCents: 39797, method: 'CARD' }, 'cashier-1'),
    ]);
    fixture.detectChanges();

    expect(till(1).getAttribute('data-status')).toBe('paid');
    expect(till(1).querySelector('.chip')?.textContent).toContain('Paid');
    expect(till(1).querySelector('.receipt')?.textContent).toContain('message 5');
  });

  it('says why a payment was declined', () => {
    const { fixture, till, events$ } = setup();

    events$.next([
      ...arrive(1), scanned(3),
      event(4, 'PAYMENT_FAILED', { customerId: 'customer-4', reason: 'Card declined' }, 'cashier-1'),
    ]);
    fixture.detectChanges();

    expect(till(1).getAttribute('data-status')).toBe('declined');
    expect(till(1).querySelector('.chip')?.textContent).toContain('Declined: Card declined');
  });

  it('clears the basket once the customer has left', () => {
    const { fixture, till, events$ } = setup();
    events$.next([...arrive(1), scanned(3)]);
    fixture.detectChanges();

    events$.next([event(4, 'TROLLEY_RESET', { trolleyId: 4 }, 'customer-4')]);
    fixture.detectChanges();

    expect(till(1).querySelector('.idle')).toBeTruthy();
    expect(till(1).getAttribute('data-status')).toBe('idle');
  });

  it('shows a closed till', () => {
    const { fixture, till, events$ } = setup();

    events$.next([event(1, 'CASHIER_CLOSED', {}, 'cashier-2')]);
    fixture.detectChanges();

    expect(till(2).querySelector('.chip')?.textContent).toContain('Closed');
  });
});
