package com.virtualtrolley.config;

/**
 * All tunable knobs in one immutable place.
 * Delays are upper bounds in ms; 0 disables them (fast tests).
 */
public record SimulationConfig(
        long seed,
        int totalCustomers,
        int batchSize,
        int trolleyCount,
        int cashierCount,
        int minItems,
        int maxItems,
        long maxShopDelayMs,
        long maxCashierDelayMs,
        double paymentFailureRate,
        long checkoutTimeoutMs) {

    public SimulationConfig {
        if (totalCustomers < 1 || batchSize < 1 || trolleyCount < 1 || cashierCount < 1) {
            throw new IllegalArgumentException("counts must be >= 1");
        }
        if (trolleyCount < batchSize) {
            // Otherwise a batch would wait on trolleys that its own members hold
            throw new IllegalArgumentException("need at least one trolley per customer in a batch");
        }
        if (minItems < 0 || maxItems < minItems) {
            throw new IllegalArgumentException("invalid item range");
        }
    }

    /** The brief: 5 customers, 5 trolleys, 2 cashiers, batches of 5. */
    public static SimulationConfig defaults() {
        return new SimulationConfig(42L, 10, 5, 5, 2, 3, 6, 400, 900, 0.10, 30_000);
    }

    public SimulationConfig withoutDelays() {
        return new SimulationConfig(seed, totalCustomers, batchSize, trolleyCount, cashierCount,
                minItems, maxItems, 0, 0, paymentFailureRate, checkoutTimeoutMs);
    }
}
