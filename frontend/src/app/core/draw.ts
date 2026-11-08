import { Layout } from './layout';
import { Product, TrolleyView } from './models';
import { Avatar } from './scene';
import { CashierWorld, ShopWorld } from './world';
import { money } from './format';

// Pure drawing: given a view and a theme, paint one frame. Uses only the standard 2D API.

export interface Theme {
  bg: string; surface: string; fg: string; muted: string; line: string;
  accent: string; ok: string; warn: string; bad: string;
}

export interface SceneView {
  layout: Layout;
  avatars: Iterable<Avatar>;
  world: ShopWorld;
  products: readonly Product[];
  stock: ReadonlyMap<number, number>;
  trolleys: readonly TrolleyView[];
}

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function drawScene(ctx: CanvasRenderingContext2D, view: SceneView, theme: Theme): void {
  const { layout } = view;
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  drawZones(ctx, layout, theme);
  drawShelves(ctx, view, theme);
  drawTills(ctx, view, theme);
  drawRack(ctx, view, theme);
  for (const avatar of view.avatars) {
    drawCustomer(ctx, avatar, view, theme);
  }
}

function drawZones(ctx: CanvasRenderingContext2D, layout: Layout, theme: Theme): void {
  ctx.fillStyle = theme.surface;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, layout.width, layout.topY);                                  // checkout zone
  ctx.fillRect(0, layout.bottomY, layout.width, layout.height - layout.bottomY);  // entrance zone
  ctx.globalAlpha = 1;

  ctx.fillStyle = theme.muted;
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('CHECKOUT', 8, 14);
  ctx.fillText('QUEUE', layout.width / 2 + 16, 154);
  ctx.textAlign = 'center';
  ctx.fillText('ENTRANCE', layout.door.x, layout.door.y + 22);
  ctx.fillText('EXIT', layout.exit.x, layout.exit.y + 22);

  // faint markers: queue slots and the spot where a customer is served at each till
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  for (const slot of layout.queue) {
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const till of layout.tills) {
    ctx.beginPath();
    ctx.arc(till.service.x, till.service.y, 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  // door and exit markers
  ctx.strokeStyle = theme.muted;
  ctx.lineWidth = 2;
  for (const p of [layout.door, layout.exit]) {
    ctx.beginPath();
    ctx.moveTo(p.x - 18, p.y + 10);
    ctx.lineTo(p.x + 18, p.y + 10);
    ctx.stroke();
  }
}

function drawShelves(ctx: CanvasRenderingContext2D, view: SceneView, theme: Theme): void {
  const names = new Map(view.products.map((p) => [p.id, p]));
  for (const shelf of view.layout.shelves) {
    ctx.fillStyle = theme.surface;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.fillRect(shelf.x, shelf.y, shelf.w, shelf.h);
    ctx.strokeRect(shelf.x, shelf.y, shelf.w, shelf.h);

    for (const cell of shelf.cells) {
      const product = names.get(cell.productId);
      const stock = view.stock.get(cell.productId);
      ctx.beginPath();
      ctx.moveTo(cell.x, shelf.y);
      ctx.lineTo(cell.x, shelf.y + shelf.h);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = theme.fg;
      ctx.font = `600 10.5px ${FONT}`;
      ctx.fillText(shortName(product?.name ?? `#${cell.productId}`), cell.x + cell.w / 2, shelf.y + 14);

      // stock level: green, amber when low, red when sold out
      const initial = product?.initialStock ?? 0;
      ctx.fillStyle = stock === undefined ? theme.muted
        : stock === 0 ? theme.bad
        : initial > 0 && stock / initial <= 0.34 ? theme.warn : theme.ok;
      ctx.font = `10px ${FONT}`;
      ctx.fillText(stock === undefined ? '' : stock === 0 ? 'sold out' : `${stock} left`, cell.x + cell.w / 2, shelf.y + 27);
    }
  }
}

function drawTills(ctx: CanvasRenderingContext2D, view: SceneView, theme: Theme): void {
  for (const till of view.layout.tills) {
    const cashier = view.world.cashiers[till.name];
    const { counter } = till;
    ctx.fillStyle = theme.surface;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.fillRect(counter.x, counter.y, counter.w, counter.h);
    ctx.strokeRect(counter.x, counter.y, counter.w, counter.h);

    // counter screen: the basket total once scanned, otherwise the till name
    ctx.textAlign = 'center';
    const showTotal = cashier?.cart && (cashier.status === 'scanning' || cashier.status === 'paid');
    ctx.fillStyle = showTotal ? theme.accent : theme.muted;
    ctx.font = `600 ${showTotal ? 12 : 10.5}px ${FONT}`;
    ctx.fillText(showTotal ? money(cashier.cart!.totalCents) : tillLabel(till.name),
      counter.x + counter.w / 2, counter.y + 19);

    ctx.fillStyle = cashierColor(cashier, theme);
    ctx.beginPath();
    ctx.arc(till.cashier.x, till.cashier.y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRack(ctx: CanvasRenderingContext2D, view: SceneView, theme: Theme): void {
  const available = new Set(view.trolleys.filter((t) => t.state === 'AVAILABLE').map((t) => t.id));
  view.layout.rack.forEach((slot, i) => {
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(slot.x - 9, slot.y - 7, 18, 14);
    if (available.has(i + 1) || view.trolleys.length === 0) {
      ctx.fillStyle = theme.muted;
      ctx.fillRect(slot.x - 7, slot.y - 5, 14, 10);
    }
  });
  ctx.fillStyle = theme.muted;
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'left';
  const first = view.layout.rack[0];
  if (first) {
    ctx.fillText('TROLLEYS', first.x - 9, first.y + 24);
  }
}

function drawCustomer(ctx: CanvasRenderingContext2D, avatar: Avatar, view: SceneView, theme: Theme): void {
  const items = view.trolleys.find((t) => t.id === avatar.trolleyId)?.itemCount ?? 0;

  // trolley trails behind the customer
  ctx.save();
  ctx.translate(avatar.x - Math.cos(avatar.heading) * 15, avatar.y - Math.sin(avatar.heading) * 15);
  ctx.rotate(avatar.heading);
  ctx.fillStyle = theme.surface;
  ctx.strokeStyle = items > 0 ? theme.accent : theme.muted;
  ctx.lineWidth = 1.5;
  ctx.fillRect(-8, -6, 16, 12);
  ctx.strokeRect(-8, -6, 16, 12);
  ctx.restore();

  if (items > 0) {
    ctx.fillStyle = theme.accent;
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(items), avatar.x - Math.cos(avatar.heading) * 15, avatar.y - Math.sin(avatar.heading) * 15 + 3);
  }

  ctx.fillStyle = `hsl(${(avatar.number * 47) % 360}, 65%, 52%)`;
  ctx.beginPath();
  ctx.arc(avatar.x, avatar.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(avatar.number), avatar.x, avatar.y + 3);
}

// ---------- small helpers ----------

function cashierColor(cashier: CashierWorld | undefined, theme: Theme): string {
  switch (cashier?.status) {
    case 'scanning': return theme.accent;
    case 'paid': return theme.ok;
    case 'declined': return theme.bad;
    default: return theme.muted; // idle or closed
  }
}

function tillLabel(name: string): string {
  const n = /(\d+)$/.exec(name)?.[1];
  return n ? `Till ${n}` : name;
}

function shortName(name: string): string {
  const words = name.split(' ');
  const short = words.length > 1 && (words[0] + ' ' + words[1]).length <= 16 ? `${words[0]} ${words[1]}` : words[0];
  return short.length > 16 ? `${short.slice(0, 15)}…` : short;
}
