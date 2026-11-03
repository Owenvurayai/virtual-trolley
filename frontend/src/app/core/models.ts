// Mirrors the backend JSON contract (SequencedEvent, SimulationSnapshot, ...).
// If a field changes in Java, change it here: TypeScript will then flag every place that breaks.

export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export type ConnectionState = 'connecting' | 'live' | 'disconnected';

export type EventType =
  | 'BATCH_STARTED' | 'BATCH_FINISHED'
  | 'TROLLEY_TAKEN' | 'TROLLEY_RESET'
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
}

export interface TrolleyView {
  id: number;
  barcode: string;
  state: 'AVAILABLE' | 'IN_USE' | 'AT_CHECKOUT' | 'BEING_SCANNED' | 'RESETTING';
  owner: string | null;
  itemCount: number;
  totalCents: number;
  totalGrams: number;
}

export interface SimulationSnapshot {
  status: SimulationStatus;
  lastSeq: number;
  trolleys: TrolleyView[];
  stock: { productId: number; available: number }[];
  stats: { revenueCents: number; salesCount: number; queueLength: number };
  recentEvents: SequencedEvent[];
}

export interface StatusResponse {
  status: SimulationStatus;
}
