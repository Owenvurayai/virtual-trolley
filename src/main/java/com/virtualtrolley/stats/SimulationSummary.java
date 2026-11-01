package com.virtualtrolley.stats;

/** Final tally returned when a simulation run completes. */
public record SimulationSummary(int paid, int paymentFailed, int abandoned,
                                long revenueCents, long elapsedMs) {

    public int totalCustomers() {
        return paid + paymentFailed + abandoned;
    }
}
