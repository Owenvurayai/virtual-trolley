import { Layout, Point, pathLength, route } from './layout';
import { CustomerWorld, Move, Place, ShopWorld } from './world';

// Walking animation. The world says WHERE each customer should be; this class moves
// avatars there along shelf-safe routes. No canvas calls, so it can be unit tested.

export const DEFAULT_SPEED = 0.14;  // world units per millisecond
const MIN_SPEED = 0.04;
const MAX_SPEED = 0.6;

interface Waypoint extends Point {
  speed: number;
}

export interface Avatar {
  id: string;
  number: number;       // customer-7 -> 7, used for colour and jitter
  trolleyId: number | null;
  x: number;
  y: number;
  heading: number;      // radians, direction of travel
  waypoints: Waypoint[];
  consumed: number;     // how many of the customer's moves are already queued here
  goal: Point;
  goalPlace: Place;
  exiting: boolean;
}

export class ShopScene {
  readonly avatars = new Map<string, Avatar>();
  private queueOrder: readonly string[] = [];

  constructor(readonly layout: Layout) {}

  /** Brings the avatars in line with the latest world state. */
  sync(world: ShopWorld): void {
    this.queueOrder = world.queue;

    for (const customer of Object.values(world.customers)) {
      const last = customer.moves.at(-1);
      if (!last) {
        continue;
      }
      const avatar = this.avatars.get(customer.id);
      if (!avatar) {
        if (last.place.kind !== 'exit') {
          this.spawn(customer, last);
        }
        continue;
      }
      const firstKept = customer.moveCount - customer.moves.length;
      for (let i = Math.max(avatar.consumed, firstKept); i < customer.moveCount; i++) {
        this.enqueue(avatar, customer.moves[i - firstKept]);
      }
      avatar.consumed = customer.moveCount;
    }

    for (const id of this.avatars.keys()) {
      if (!world.customers[id]) {
        this.avatars.delete(id); // run was reset
      }
    }
    this.retargetQueue();
  }

  /** Advances every avatar by dtMs. */
  step(dtMs: number): void {
    for (const avatar of this.avatars.values()) {
      // Rubber band: when events outpace walking, catch up instead of lagging further behind
      const backlog = avatar.waypoints.length;
      const boost = backlog > 9 ? 3 : backlog > 6 ? 2 : 1;
      let budget = dtMs * boost;

      while (avatar.waypoints.length > 0 && budget > 0) {
        const target = avatar.waypoints[0];
        const dx = target.x - avatar.x;
        const dy = target.y - avatar.y;
        const dist = Math.hypot(dx, dy);
        const reach = target.speed * budget;
        if (dist > 0.01) {
          avatar.heading = Math.atan2(dy, dx);
        }
        if (dist <= reach) {
          avatar.x = target.x;
          avatar.y = target.y;
          budget -= target.speed > 0 ? dist / target.speed : 0;
          avatar.waypoints.shift();
        } else {
          avatar.x += (dx / dist) * reach;
          avatar.y += (dy / dist) * reach;
          budget = 0;
        }
      }

      if (avatar.waypoints.length === 0) {
        if (avatar.exiting) {
          this.avatars.delete(avatar.id);
        } else if (avatar.goalPlace.kind !== 'rack') {
          avatar.heading = -Math.PI / 2; // waiting at a shelf, in the queue or at a till: face away from the trolley
        }
      }
    }
  }

  // ---------- internals ----------

  private spawn(customer: CustomerWorld, last: Move): void {
    const number = customerNumber(customer.id);
    const avatar: Avatar = {
      id: customer.id, number, trolleyId: customer.trolleyId,
      x: 0, y: 0, heading: -Math.PI / 2, waypoints: [],
      consumed: customer.moveCount, goal: { x: 0, y: 0 }, goalPlace: last.place, exiting: false,
    };
    const start = this.pointOf(last.place, avatar); // appears at its latest place: no long walk after a refresh
    avatar.x = start.x;
    avatar.y = start.y;
    avatar.goal = start;
    this.avatars.set(customer.id, avatar);
  }

  private enqueue(avatar: Avatar, move: Move): void {
    const from = avatar.waypoints.at(-1) ?? avatar;
    const to = this.pointOf(move.place, avatar);
    const path = route(this.layout, from, to);
    const length = pathLength(from, path);
    const speed = move.etaMs && move.etaMs > 0
      ? clamp(length / move.etaMs, MIN_SPEED, MAX_SPEED) // arrive when the backend says the walk ends
      : DEFAULT_SPEED;
    for (const p of path) {
      avatar.waypoints.push({ x: p.x, y: p.y, speed });
    }
    avatar.goal = to;
    avatar.goalPlace = move.place;
    avatar.exiting = move.place.kind === 'exit';
  }

  /** Customers in the line shuffle forward as those ahead are served. */
  private retargetQueue(): void {
    for (const avatar of this.avatars.values()) {
      if (avatar.goalPlace.kind !== 'queue') {
        continue;
      }
      const wanted = this.pointOf(avatar.goalPlace, avatar);
      if (Math.hypot(wanted.x - avatar.goal.x, wanted.y - avatar.goal.y) < 0.5) {
        continue;
      }
      const last = avatar.waypoints.at(-1);
      if (last) {
        last.x = wanted.x;
        last.y = wanted.y;
      } else {
        avatar.waypoints.push({ ...wanted, speed: DEFAULT_SPEED });
      }
      avatar.goal = wanted;
    }
  }

  private pointOf(place: Place, avatar: Pick<Avatar, 'id' | 'number' | 'trolleyId'>): Point {
    const { layout } = this;
    switch (place.kind) {
      case 'rack':
        return layout.rack[(avatar.trolleyId ?? 1) - 1] ?? layout.door;
      case 'shelf': {
        const stand = layout.standPoint(place.productId) ?? layout.door;
        // Spread customers out so two at one shelf do not overlap
        return { x: stand.x + ((avatar.number % 3) - 1) * 11, y: stand.y + (avatar.number % 2) * 7 - 3 };
      }
      case 'queue': {
        const index = Math.max(0, this.queueOrder.indexOf(avatar.id));
        return layout.queue[Math.min(index, layout.queue.length - 1)];
      }
      case 'till':
        return layout.tills.find((t) => t.name === place.cashier)?.service ?? layout.door;
      case 'exit':
        return layout.exit;
    }
  }
}

function customerNumber(id: string): number {
  const match = /(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
