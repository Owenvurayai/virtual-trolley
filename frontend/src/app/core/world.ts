import { SequencedEvent } from './models';

// A pure model of "who is where" and "what each till shows", rebuilt from the event stream.
// No canvas, no Angular: easy to test.

export type Place =
  | { kind: 'rack' }
  | { kind: 'shelf'; productId: number }
  | { kind: 'queue' }
  | { kind: 'till'; cashier: string }
  | { kind: 'exit' };

export interface Move {
  place: Place;
  etaMs?: number; // announced walking time, so the animation can match the real delay
}

export interface CustomerWorld {
  id: string;
  trolleyId: number | null;
  moves: Move[];     // most recent moves only
  moveCount: number; // total moves ever; lets the animation know which ones it has not seen yet
}

export interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  lineCents: number;
}

export interface CartInfo {
  customerId: string;
  trolleyId: number;
  barcode: string;
  items: CartItem[];
  itemCount: number;
  totalCents: number;
  totalGrams: number;
  waitMs: number;
}

export interface ReceiptInfo {
  number: number;
  customerId: string;
  method: string;
  totalCents: number;
  text: string; // the formatted receipt exactly as printed by the backend
}

export type CashierStatus = 'idle' | 'scanning' | 'paid' | 'declined' | 'closed';

export interface CashierWorld {
  name: string;
  status: CashierStatus;
  customer: string | null;
  cart: CartInfo | null;
  receipt: ReceiptInfo | null;
  declineReason: string | null;
}

export interface ShopWorld {
  customers: Record<string, CustomerWorld>;
  cashiers: Record<string, CashierWorld>;
  cashierOrder: string[];
  queue: string[]; // customer ids in the order they joined the line
}

const MAX_MOVES = 24;
export const DEFAULT_CASHIERS = ['cashier-1', 'cashier-2'];

export function emptyWorld(cashierNames: readonly string[] = DEFAULT_CASHIERS): ShopWorld {
  const cashiers: Record<string, CashierWorld> = {};
  for (const name of cashierNames) {
    cashiers[name] = { name, status: 'idle', customer: null, cart: null, receipt: null, declineReason: null };
  }
  return { customers: {}, cashiers, cashierOrder: [...cashierNames], queue: [] };
}

/** Folds one event into the world. Never mutates its input. */
export function reduceWorld(world: ShopWorld, event: SequencedEvent): ShopWorld {
  switch (event.type) {
    case 'SIMULATION_STARTED':
    case 'SIMULATION_RESET':
      return emptyWorld(world.cashierOrder);

    case 'TROLLEY_TAKEN':
      return withCustomer(world, {
        id: event.actor,
        trolleyId: num(event.data, 'trolleyId'),
        moves: [{ place: { kind: 'rack' } }],
        moveCount: 1,
      });

    case 'CUSTOMER_WALKING': {
      const productId = num(event.data, 'productId');
      return productId === null
        ? world
        : addMove(world, event.actor, { place: { kind: 'shelf', productId }, etaMs: num(event.data, 'etaMs') ?? undefined });
    }

    case 'CUSTOMER_AT_TILL': {
      const moved = addMove(world, event.actor, { place: { kind: 'queue' } });
      return { ...moved, queue: [...moved.queue.filter((id) => id !== event.actor), event.actor] };
    }

    case 'CART_SCANNED': {
      const customerId = str(event.data, 'customerId');
      if (customerId === null) {
        return world;
      }
      const moved = addMove(world, customerId, { place: { kind: 'till', cashier: event.actor } });
      return {
        ...moved,
        queue: moved.queue.filter((id) => id !== customerId),
        cashiers: updateCashier(moved, event.actor, {
          status: 'scanning', customer: customerId, cart: toCart(event.data), declineReason: null,
        }),
      };
    }

    case 'PAYMENT_OK':
      return { ...world, cashiers: updateCashier(world, event.actor, { status: 'paid' }) };

    case 'PAYMENT_FAILED':
      return {
        ...world,
        cashiers: updateCashier(world, event.actor, {
          status: 'declined', declineReason: str(event.data, 'reason'),
        }),
      };

    case 'RECEIPT_PRINTED':
      return {
        ...world,
        cashiers: updateCashier(world, event.actor, {
          receipt: {
            number: num(event.data, 'receiptNumber') ?? 0,
            customerId: str(event.data, 'customerId') ?? '',
            method: str(event.data, 'method') ?? '',
            totalCents: num(event.data, 'totalCents') ?? 0,
            text: event.message,
          },
        }),
      };

    case 'TROLLEY_RESET': {
      // The customer walks out; any till that was serving them goes back to idle
      const left = addMove(world, event.actor, { place: { kind: 'exit' } });
      const cashiers = { ...left.cashiers };
      for (const name of left.cashierOrder) {
        if (cashiers[name].customer === event.actor) {
          cashiers[name] = { ...cashiers[name], status: 'idle', customer: null, cart: null, declineReason: null };
        }
      }
      return { ...left, cashiers, queue: left.queue.filter((id) => id !== event.actor) };
    }

    case 'CASHIER_CLOSED':
      return { ...world, cashiers: updateCashier(world, event.actor, { status: 'closed' }) };

    default:
      return world;
  }
}

/** Rebuilds a world from scratch, e.g. after a page refresh. */
export function replay(events: readonly SequencedEvent[], cashierNames?: readonly string[]): ShopWorld {
  return events.reduce(reduceWorld, emptyWorld(cashierNames));
}

// ---------- helpers ----------

function withCustomer(world: ShopWorld, customer: CustomerWorld): ShopWorld {
  return { ...world, customers: { ...world.customers, [customer.id]: customer } };
}

function addMove(world: ShopWorld, customerId: string, move: Move): ShopWorld {
  const existing = world.customers[customerId];
  if (!existing) {
    return world; // an event for a customer we never saw arrive (history was trimmed)
  }
  return withCustomer(world, {
    ...existing,
    moves: [...existing.moves, move].slice(-MAX_MOVES),
    moveCount: existing.moveCount + 1,
  });
}

function updateCashier(world: ShopWorld, name: string, patch: Partial<CashierWorld>): Record<string, CashierWorld> {
  const current = world.cashiers[name]
    ?? { name, status: 'idle', customer: null, cart: null, receipt: null, declineReason: null } as CashierWorld;
  return { ...world.cashiers, [name]: { ...current, ...patch } };
}

function toCart(data: Record<string, unknown>): CartInfo {
  const items = Array.isArray(data['items']) ? (data['items'] as Record<string, unknown>[]) : [];
  return {
    customerId: str(data, 'customerId') ?? '',
    trolleyId: num(data, 'trolleyId') ?? 0,
    barcode: str(data, 'barcode') ?? '',
    items: items.map((item) => ({
      productId: num(item, 'productId') ?? 0,
      name: str(item, 'name') ?? '',
      quantity: num(item, 'quantity') ?? 0,
      lineCents: num(item, 'lineCents') ?? 0,
    })),
    itemCount: num(data, 'itemCount') ?? 0,
    totalCents: num(data, 'totalCents') ?? 0,
    totalGrams: num(data, 'totalGrams') ?? 0,
    waitMs: num(data, 'waitMs') ?? 0,
  };
}

function num(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === 'number' ? value : null;
}

function str(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' ? value : null;
}
