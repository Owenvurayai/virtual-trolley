import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { kg, money } from '../../core/format';
import { SimulationStore } from '../../core/simulation-store.service';
import { CashierWorld } from '../../core/world';

/** What each cashier sees: the scanned basket appears at once, then the printed receipt. */
@Component({
  selector: 'app-cashier-screen',
  templateUrl: './cashier-screen.html',
  styleUrl: './cashier-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierScreen {
  private readonly store = inject(SimulationStore);

  protected readonly cashiers = computed<CashierWorld[]>(() => {
    const world = this.store.world();
    return world.cashierOrder.map((name) => world.cashiers[name]);
  });
  protected readonly connection = this.store.connection;

  protected readonly money = money;
  protected readonly kg = kg;

  protected title(name: string): string {
    const n = /(\d+)$/.exec(name)?.[1];
    return n ? `Till ${n}` : name;
  }

  protected statusText(cashier: CashierWorld): string {
    switch (cashier.status) {
      case 'scanning': return 'Taking payment';
      case 'paid': return 'Paid';
      case 'declined': return `Declined${cashier.declineReason ? `: ${cashier.declineReason}` : ''}`;
      case 'closed': return 'Closed';
      default: return 'Waiting for next customer';
    }
  }
}
