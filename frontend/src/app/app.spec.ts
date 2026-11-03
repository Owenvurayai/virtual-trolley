import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { createFakes } from './testing/fakes';

describe('App', () => {
  it('renders the header, controls and event log', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: createFakes().providers });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Virtual Trolley');
    expect(root.querySelector('app-control-bar')).toBeTruthy();
    expect(root.querySelector('app-event-log')).toBeTruthy();
  });
});
