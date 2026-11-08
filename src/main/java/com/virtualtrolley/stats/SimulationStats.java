package com.virtualtrolley.stats;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

/** Thread-safe counters updated by cashiers and the batch controller. Lock-free. */
public final class SimulationStats {

    // sales
    private final LongAdder revenueCents = new LongAdder();
    private final AtomicInteger salesCount = new AtomicInteger();

    // time customers spent in the till queue
    private final LongAdder waitTotalMs = new LongAdder();
    private final LongAdder waitCount = new LongAdder();
    private final AtomicLong waitMaxMs = new AtomicLong();

    // time each cashier spent actually serving (drives utilisation)
    private final Map<String, LongAdder> busyMs = new ConcurrentHashMap<>();

    // batches
    private final AtomicInteger batches = new AtomicInteger();
    private final AtomicLong lastBatchMs = new AtomicLong();

    public void recordSale(long cents) {
        revenueCents.add(cents);
        salesCount.incrementAndGet();
    }

    public void recordQueueWait(long ms) {
        waitTotalMs.add(ms);
        waitCount.increment();
        waitMaxMs.accumulateAndGet(ms, Math::max);
    }

    public void recordBusy(String cashier, long ms) {
        busyMs.computeIfAbsent(cashier, name -> new LongAdder()).add(ms);
    }

    public void recordBatch(long ms) {
        batches.incrementAndGet();
        lastBatchMs.set(ms);
    }

    public long revenueCents() {
        return revenueCents.sum();
    }

    public int salesCount() {
        return salesCount.get();
    }

    public long queueWaitCount() {
        return waitCount.sum();
    }

    public long avgQueueWaitMs() {
        long n = waitCount.sum();
        return n == 0 ? 0 : waitTotalMs.sum() / n;
    }

    public long maxQueueWaitMs() {
        return waitMaxMs.get();
    }

    public long busyMs(String cashier) {
        LongAdder adder = busyMs.get(cashier);
        return adder == null ? 0 : adder.sum();
    }

    public int batchesCompleted() {
        return batches.get();
    }

    public long lastBatchMs() {
        return lastBatchMs.get();
    }
}
