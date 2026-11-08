import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, effect, inject, untracked, viewChild,
} from '@angular/core';
import { Theme, drawScene } from '../../core/draw';
import { Layout, buildLayout } from '../../core/layout';
import { ShopScene } from '../../core/scene';
import { SimulationStore } from '../../core/simulation-store.service';

const FALLBACK_THEME: Theme = {
  bg: '#f6f7f9', surface: '#ffffff', fg: '#1b1d21', muted: '#6a7078', line: '#d9dde3',
  accent: '#2563eb', ok: '#15803d', warn: '#b45309', bad: '#b91c1c',
};

/** Top-down shop. Canvas drawing runs on its own animation loop, separate from Angular rendering. */
@Component({
  selector: 'app-shop-map',
  template: '<canvas #canvas aria-label="Top-down map of the shop"></canvas>',
  styles: `
    :host { display: block; width: 100%; }
    canvas { display: block; width: 100%; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopMap implements OnDestroy {
  private readonly store = inject(SimulationStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  private layout: Layout | null = null;
  private scene: ShopScene | null = null;
  private theme: Theme = FALLBACK_THEME;
  private scale = 1;
  private frameId = 0;
  private lastTime = 0;
  private resizeObserver?: ResizeObserver;
  private colourQuery?: MediaQueryList;

  private readonly onColourSchemeChange = (): void => {
    this.theme = this.readTheme();
  };

  constructor() {
    // Rebuild the layout when the catalogue, number of tills or number of trolleys changes
    effect(() => {
      const products = this.store.products();
      const cashiers = this.store.cashierNames();
      const trolleys = this.store.trolleyCount();
      this.layout = buildLayout(products, cashiers, trolleys);
      this.scene = new ShopScene(this.layout);
      this.scene.sync(untracked(() => this.store.world()));
      this.resize();
    });

    // Tell the animation about every change in who is where
    effect(() => {
      this.scene?.sync(this.store.world());
    });

    afterNextRender(() => {
      this.theme = this.readTheme();
      this.resize();
      this.colourQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
      this.colourQuery?.addEventListener('change', this.onColourSchemeChange);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.host.nativeElement);
      }
      if (typeof requestAnimationFrame === 'function') {
        this.frameId = requestAnimationFrame(this.frame);
      }
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.colourQuery?.removeEventListener('change', this.onColourSchemeChange);
  }

  private readonly frame = (time: number): void => {
    const dt = Math.min(100, time - (this.lastTime || time)); // clamp: a backgrounded tab must not teleport everyone
    this.lastTime = time;
    this.scene?.step(dt);
    this.paint();
    this.frameId = requestAnimationFrame(this.frame);
  };

  private paint(): void {
    const canvas = this.canvas()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !this.layout || !this.scene) {
      return;
    }
    const ratio = canvas.width / this.layout.width; // device pixels per world unit
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawScene(ctx, {
      layout: this.layout,
      avatars: this.scene.avatars.values(),
      world: this.store.world(),
      products: this.store.products(),
      stock: this.store.stock(),
      trolleys: this.store.trolleys(),
    }, this.theme);
  }

  /** Fits the map to the available width and keeps it sharp on high-DPI screens. */
  private resize(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.layout) {
      return;
    }
    const width = this.host.nativeElement.clientWidth || 360;
    const dpr = globalThis.devicePixelRatio || 1;
    this.scale = width / this.layout.width;
    const cssHeight = this.layout.height * this.scale;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  /** The canvas cannot use CSS variables directly, so read their current values. */
  private readTheme(): Theme {
    const styles = getComputedStyle(this.host.nativeElement);
    const pick = (name: string, fallback: string): string => styles.getPropertyValue(name).trim() || fallback;
    return {
      bg: pick('--bg', FALLBACK_THEME.bg), surface: pick('--surface', FALLBACK_THEME.surface),
      fg: pick('--fg', FALLBACK_THEME.fg), muted: pick('--muted', FALLBACK_THEME.muted),
      line: pick('--line', FALLBACK_THEME.line), accent: pick('--accent', FALLBACK_THEME.accent),
      ok: pick('--ok', FALLBACK_THEME.ok), warn: pick('--warn', FALLBACK_THEME.warn),
      bad: pick('--bad', FALLBACK_THEME.bad),
    };
  }
}
