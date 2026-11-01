package com.virtualtrolley.payment;

import com.virtualtrolley.domain.model.CartSnapshot;

import java.util.Random;

/** Simulated card terminal that declines a configurable share of payments. */
public final class CardPayment implements PaymentStrategy {

    private final double failureRate;
    private final Random random; // java.util.Random is thread-safe

    public CardPayment(double failureRate, long seed) {
        this.failureRate = failureRate;
        this.random = new Random(seed);
    }

    @Override
    public PaymentResult pay(CartSnapshot cart, String customerId) {
        if (random.nextDouble() < failureRate) {
            return PaymentResult.declined("CARD", "Card declined");
        }
        return PaymentResult.approved("CARD");
    }
}
