import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ControlBar } from '../control-bar/control-bar';
import { EventLog } from '../event-log/event-log';
import { ShopMap } from '../shop-map/shop-map';
import { StatsPanel } from '../stats-panel/stats-panel';

@Component({
  selector: 'app-dashboard',
  imports: [ControlBar, ShopMap, StatsPanel, EventLog],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {}
