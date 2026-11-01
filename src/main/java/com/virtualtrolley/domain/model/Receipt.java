package com.virtualtrolley.domain.model;

import java.time.Instant;

/** Proof of a completed sale. */
public record Receipt(long number, String customerId, String cashierName,
                      CartSnapshot cart, String paymentMethod, Instant issuedAt) {

    public long totalCents() {
        return cart.totalCents();
    }
}
