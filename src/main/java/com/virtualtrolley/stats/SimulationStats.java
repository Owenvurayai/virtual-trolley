package com.virtualtrolley.stats;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.LongAdder;

/** Thread-safe counters updated by the cashiers. */
public final class SimulationStats {

    private final LongAdder revenueCents = new LongAdder();
    private final AtomicInteger salesCount = new AtomicInteger();

    public void recordSale(long cents) {
        revenueCents.add(cents);
        salesCount.incrementAndGet();
    }

    public long revenueCents() {
        return revenueCents.sum();
    }

    public int salesCount() {
        return salesCount.get();
    }
}
