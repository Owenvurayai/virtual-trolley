package com.virtualtrolley.payment;

public record PaymentResult(boolean approved, String method, String reason) {

    public static PaymentResult approved(String method) {
        return new PaymentResult(true, method, null);
    }

    public static PaymentResult declined(String method, String reason) {
        return new PaymentResult(false, method, reason);
    }
}
