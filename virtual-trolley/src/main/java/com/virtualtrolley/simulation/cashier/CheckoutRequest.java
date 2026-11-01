package com.virtualtrolley.simulation.cashier;

import com.virtualtrolley.domain.model.Receipt;
import com.virtualtrolley.domain.model.Trolley;

import java.util.concurrent.CompletableFuture;

/** A customer's place in the till queue; the future completes when the cashier is done. */
public record CheckoutRequest(String customerId, Trolley trolley, CompletableFuture<Receipt> result) {

    /** Sentinel that tells a cashier thread to stop (poison pill). */
    public static final CheckoutRequest POISON_PILL = new CheckoutRequest("POISON", null, null);

    public boolean isPoisonPill() {
        return this == POISON_PILL;
    }
}
