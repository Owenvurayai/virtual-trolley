package com.virtualtrolley.payment;

/** Delivered to the waiting customer when the cashier could not take payment. */
public class PaymentFailedException extends RuntimeException {

    public PaymentFailedException(String reason) {
        super(reason);
    }
}
