package com.virtualtrolley.events;

/** Everything observable in the simulation. Becomes the WebSocket contract in Week 3. */
public enum EventType {
    BATCH_STARTED, BATCH_FINISHED,
    TROLLEY_TAKEN, TROLLEY_RESET,
    ITEM_ADDED, ITEM_REMOVED, OUT_OF_STOCK,
    CUSTOMER_AT_TILL, CART_SCANNED,
    PAYMENT_OK, PAYMENT_FAILED, RECEIPT_PRINTED,
    CASHIER_CLOSED, ERROR
}
