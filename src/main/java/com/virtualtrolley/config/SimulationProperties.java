package com.virtualtrolley.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Bound from application.yml under trolley.simulation. Defaults match SimulationConfig.defaults(). */
@ConfigurationProperties(prefix = "trolley.simulation")
public record SimulationProperties(
        @DefaultValue("42") long seed,
        @DefaultValue("10") int totalCustomers,
        @DefaultValue("5") int batchSize,
        @DefaultValue("5") int trolleyCount,
        @DefaultValue("2") int cashierCount,
        @DefaultValue("3") int minItems,
        @DefaultValue("6") int maxItems,
        @DefaultValue("400") long maxShopDelayMs,
        @DefaultValue("900") long maxCashierDelayMs,
        @DefaultValue("0.10") double paymentFailureRate,
        // Generous: time spent paused also counts against a customer waiting at the till
        @DefaultValue("600000") long checkoutTimeoutMs) {

    public SimulationConfig toConfig() {
        return new SimulationConfig(seed, totalCustomers, batchSize, trolleyCount, cashierCount,
                minItems, maxItems, maxShopDelayMs, maxCashierDelayMs, paymentFailureRate, checkoutTimeoutMs);
    }
}
