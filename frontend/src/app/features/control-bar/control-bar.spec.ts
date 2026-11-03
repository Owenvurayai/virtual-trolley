import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SimulationStore } from '../../core/simulation-store.service';
import { createFakes, event } from '../../testing/fakes';
import { ControlBar } from './control-bar';

function setup() {
  const fakes = createFakes();
  TestBed.configureTestingModule({ imports: [ControlBar], providers: fakes.providers });
  const fixture = TestBed.createComponent(ControlBar);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
  return { fixture, root, button, store: TestBed.inject(SimulationStore), ...fakes };
}

describe('ControlBar', () => {
  it('only offers Start while idle', () => {
    const { button } = setup();

    expect(button('Start').disabled).toBe(false);
    expect(button('Pause').disabled).toBe(true);
    expect(button('Resume').disabled).toBe(true);
    expect(button('Reset').disabled).toBe(true);
  });

  it('switches to Pause and Reset once the simulation is running', () => {
    const { fixture, button, events$ } = setup();

    events$.next([event(1, 'SIMULATION_STARTED')]);
    fixture.detectChanges();

    expect(button('Start').disabled).toBe(true);
    expect(button('Pause').disabled).toBe(false);
    expect(button('Reset').disabled).toBe(false);
  });

  it('calls the API when Start is clicked', () => {
    const { button, api } = setup();

    button('Start').click();

    expect(api.start).toHaveBeenCalledOnce();
  });

  it('shows the connection state and any error', () => {
    const { fixture, root, connection$, store } = setup();
    connection$.next('live');
    (store as unknown as { _error: { set(v: string): void } })._error.set('Cannot pause while IDLE');
    fixture.detectChanges();

    expect(root.querySelector('.conn')?.textContent).toContain('live');
    expect(root.querySelector('.error')?.textContent).toContain('Cannot pause while IDLE');
  });
});
