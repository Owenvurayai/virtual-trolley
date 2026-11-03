import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { EventType, SequencedEvent } from '../../core/models';
import { SimulationStore } from '../../core/simulation-store.service';

type Category = 'all' | 'shopping' | 'checkout' | 'system';

/** Which filter chip does each event type belong to? */
const CATEGORY_OF: Record<EventType, Exclude<Category, 'all'>> = {
  TROLLEY_TAKEN: 'shopping', TROLLEY_RESET: 'shopping',
  ITEM_ADDED: 'shopping', ITEM_REMOVED: 'shopping', OUT_OF_STOCK: 'shopping',
  CUSTOMER_AT_TILL: 'checkout', CART_SCANNED: 'checkout', PAYMENT_OK: 'checkout',
  PAYMENT_FAILED: 'checkout', RECEIPT_PRINTED: 'checkout', CASHIER_CLOSED: 'checkout',
  BATCH_STARTED: 'system', BATCH_FINISHED: 'system', ERROR: 'system',
  SIMULATION_STARTED: 'system', SIMULATION_PAUSED: 'system', SIMULATION_RESUMED: 'system',
  SIMULATION_FINISHED: 'system', SIMULATION_RESET: 'system',
};

@Component({
  selector: 'app-event-log',
  imports: [DatePipe],
  templateUrl: './event-log.html',
  styleUrl: './event-log.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventLog {
  private readonly store = inject(SimulationStore);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly categories: Category[] = ['all', 'shopping', 'checkout', 'system'];
  protected readonly category = signal<Category>('all');
  protected readonly follow = signal(true);

  protected readonly total = computed(() => this.store.events().length);
  protected readonly visible = computed(() => {
    const category = this.category();
    const events = this.store.events();
    return category === 'all' ? events : events.filter((e) => CATEGORY_OF[e.type] === category);
  });

  constructor() {
    // Whenever the visible list changes and "follow" is on, jump to the newest line
    effect(() => {
      this.visible();
      if (this.follow()) {
        setTimeout(() => {
          const el = this.scroller()?.nativeElement;
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        });
      }
    });
  }

  protected setCategory(category: Category): void {
    this.category.set(category);
  }

  protected toggleFollow(): void {
    this.follow.update((on) => !on);
  }

  /** Lets the template colour each row by category. */
  protected categoryOf(event: SequencedEvent): string {
    return event.type === 'ERROR' || event.type === 'PAYMENT_FAILED' || event.type === 'OUT_OF_STOCK'
      ? 'warn'
      : CATEGORY_OF[event.type];
  }
}
