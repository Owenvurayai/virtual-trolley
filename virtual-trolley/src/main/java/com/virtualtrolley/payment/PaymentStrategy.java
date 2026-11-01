package com.virtualtrolley.payment;

import com.virtualtrolley.domain.model.CartSnapshot;

/** Strategy: swap card / cash / mobile without touching the cashier. */
public interface PaymentStrategy {

    PaymentResult pay(CartSnapshot cart, String customerId);
}
