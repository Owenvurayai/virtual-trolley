import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { createFakes } from '../../testing/fakes';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  it('brings together the controls, the shop map, the stats and the event log', async () => {
    TestBed.configureTestingModule({ imports: [Dashboard], providers: createFakes().providers });
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-control-bar')).toBeTruthy();
    expect(root.querySelector('app-shop-map canvas')).toBeTruthy();
    expect(root.querySelector('app-stats-panel')).toBeTruthy();
    expect(root.querySelector('app-event-log')).toBeTruthy();
  });
});
