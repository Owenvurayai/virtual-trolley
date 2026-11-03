import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ControlBar } from './features/control-bar/control-bar';
import { EventLog } from './features/event-log/event-log';

@Component({
  selector: 'app-root',
  imports: [ControlBar, EventLog],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
