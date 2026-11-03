import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SimulationStore } from '../../core/simulation-store.service';

@Component({
  selector: 'app-control-bar',
  templateUrl: './control-bar.html',
  styleUrl: './control-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlBar {
  protected readonly store = inject(SimulationStore);
}
