package com.virtualtrolley.stats;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SimulationStatsTest {

    private final SimulationStats stats = new SimulationStats();

    @Test
    void queueWaitTracksAverageAndMaximum() {
        stats.recordQueueWait(100);
        stats.recordQueueWait(300);
        stats.recordQueueWait(200);

        assertEquals(3, stats.queueWaitCount());
        assertEquals(200, stats.avgQueueWaitMs());
        assertEquals(300, stats.maxQueueWaitMs());
    }

    @Test
    void averageIsZeroBeforeAnyoneHasQueued() {
        assertEquals(0, stats.avgQueueWaitMs());
        assertEquals(0, stats.maxQueueWaitMs());
    }

    @Test
    void busyTimeIsTrackedPerCashier() {
        stats.recordBusy("cashier-1", 500);
        stats.recordBusy("cashier-1", 250);
        stats.recordBusy("cashier-2", 100);

        assertEquals(750, stats.busyMs("cashier-1"));
        assertEquals(100, stats.busyMs("cashier-2"));
        assertEquals(0, stats.busyMs("cashier-3"));
    }

    @Test
    void batchesRememberTheLastDuration() {
        stats.recordBatch(4_000);
        stats.recordBatch(5_500);

        assertEquals(2, stats.batchesCompleted());
        assertEquals(5_500, stats.lastBatchMs());
    }

    @Test
    void salesAccumulateRevenue() {
        stats.recordSale(1_000);
        stats.recordSale(2_550);

        assertEquals(2, stats.salesCount());
        assertEquals(3_550, stats.revenueCents());
    }
}
