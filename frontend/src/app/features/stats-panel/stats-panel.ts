import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { duration, money } from '../../core/format';
import { SimulationStore } from '../../core/simulation-store.service';

@Component({
  selector: 'app-stats-panel',
  templateUrl: './stats-panel.html',
  styleUrl: './stats-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPanel {
  private readonly store = inject(SimulationStore);

  protected readonly stats = this.store.stats;
  protected readonly cashiers = computed(() => this.stats().cashiers);

  protected readonly trolleysFree = computed(() => this.store.trolleys().filter((t) => t.state === 'AVAILABLE').length);
  protected readonly trolleysTotal = computed(() => this.store.trolleys().length);
  protected readonly shoppers = computed(() => this.trolleysTotal() - this.trolleysFree());

  protected readonly revenue = computed(() => money(this.stats().revenueCents));
  protected readonly avgWait = computed(() => duration(this.stats().avgQueueWaitMs));
  protected readonly maxWait = computed(() => duration(this.stats().maxQueueWaitMs));
  protected readonly runTime = computed(() => duration(this.stats().activeElapsedMs));
  protected readonly lastBatch = computed(() =>
    this.stats().batchesCompleted > 0 ? duration(this.stats().lastBatchMs) : '-');
}
