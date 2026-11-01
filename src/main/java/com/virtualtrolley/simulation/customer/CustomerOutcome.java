package com.virtualtrolley.simulation.customer;

/** How a customer's visit ended. */
public enum CustomerOutcome {
    PAID,
    PAYMENT_FAILED,
    ABANDONED // timed out, interrupted or hit an unexpected error
}
