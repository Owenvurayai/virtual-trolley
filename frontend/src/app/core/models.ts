// Mirrors the backend JSON contract. If a field changes in Java, change it here:
// TypeScript then flags every place that breaks.

export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export type ConnectionState = 'connecting' | 'live' | 'disconnected';

export type EventType =
  | 'BATCH_STARTED' | 'BATCH_FINISHED'
  | 'TROLLEY_TAKEN' | 'TROLLEY_RESET' | 'CUSTOMER_WALKING'
  | 'ITEM_ADDED' | 'ITEM_REMOVED' | 'OUT_OF_STOCK'
  | 'CUSTOMER_AT_TILL' | 'CART_SCANNED'
  | 'PAYMENT_OK' | 'PAYMENT_FAILED' | 'RECEIPT_PRINTED'
  | 'CASHIER_CLOSED' | 'ERROR'
  | 'SIMULATION_STARTED' | 'SIMULATION_PAUSED' | 'SIMULATION_RESUMED'
  | 'SIMULATION_FINISHED' | 'SIMULATION_RESET';

export interface SequencedEvent {
  seq: number;      // strictly increasing; lets the client drop duplicates
  type: EventType;
  actor: string;
  message: string;
  at: number;       // epoch milliseconds
  data: Record<string, unknown>; // structured details; keys depend on the event type
}

export type TrolleyStateName = 'AVAILABLE' | 'IN_USE' | 'AT_CHECKOUT' | 'BEING_SCANNED' | 'RESETTING';

export interface TrolleyView {
  id: number;
  barcode: string;
  state: TrolleyStateName;
  owner: string | null;
  itemCount: number;
  totalCents: number;
  totalGrams: number;
}

export interface CashierLoad {
  name: string;
  busyMs: number;
  utilisationPct: number;
}

export interface StatsView {
  revenueCents: number;
  salesCount: number;
  queueLength: number;
  avgQueueWaitMs: number;
  maxQueueWaitMs: number;
  batchesCompleted: number;
  lastBatchMs: number;
  activeElapsedMs: number;
  cashiers: CashierLoad[];
}

export interface StockView {
  productId: number;
  available: number;
}

export interface SimulationSnapshot {
  status: SimulationStatus;
  lastSeq: number;
  trolleys: TrolleyView[];
  stock: StockView[];
  stats: StatsView;
  recentEvents: SequencedEvent[]; // empty in the periodic /topic/state broadcasts
}

export interface StatusResponse {
  status: SimulationStatus;
}

export interface Product {
  id: number;
  name: string;
  priceCents: number;
  weightGrams: number;
  initialStock: number;
}
