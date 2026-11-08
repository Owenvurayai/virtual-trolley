import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { createFakes } from './testing/fakes';

describe('App', () => {
  it('renders the title and the navigation between the shop and the cashier screens', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createFakes().providers, provideRouter([])],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Virtual Trolley');
    const links = Array.from(root.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(links).toEqual(['Shop', 'Cashiers']);
    expect(root.querySelector('router-outlet')).toBeTruthy();
  });
});
