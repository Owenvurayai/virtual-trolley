package com.virtualtrolley.simulation;

import com.virtualtrolley.domain.model.Trolley;
import com.virtualtrolley.domain.model.TrolleyState;
import com.virtualtrolley.simulation.pool.TrolleyPool;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class TrolleyPoolTest {

    @Test
    void acquiredTrolleyIsLockedToItsCustomer() throws Exception {
        TrolleyPool pool = new TrolleyPool(5);

        Trolley trolley = pool.acquire("thandi");

        assertEquals(TrolleyState.IN_USE, trolley.state());
        assertEquals("thandi", trolley.owner());
        assertEquals(4, pool.availableCount());
    }

    @Test
    void sixthCustomerWaitsUntilATrolleyIsReleased() throws Exception {
        TrolleyPool pool = new TrolleyPool(5);
        Trolley first = pool.acquire("c1");
        for (int i = 2; i <= 5; i++) {
            pool.acquire("c" + i);
        }

        CompletableFuture<Trolley> sixth = CompletableFuture.supplyAsync(() -> {
            try {
                return pool.acquire("c6");
            } catch (InterruptedException e) {
                throw new IllegalStateException(e);
            }
        });

        Thread.sleep(200); // give it a fair chance to (wrongly) succeed
        assertFalse(sixth.isDone(), "pool is empty, c6 must block");

        pool.release(first);

        Trolley got = sixth.get(2, TimeUnit.SECONDS);
        assertSame(first, got);
        assertEquals("c6", got.owner());
    }

    @Test
    void releaseResetsTheTrolley() throws Exception {
        TrolleyPool pool = new TrolleyPool(1);
        Trolley trolley = pool.acquire("c1");

        pool.release(trolley);

        assertEquals(TrolleyState.AVAILABLE, trolley.state());
        assertNull(trolley.owner());
        assertEquals(1, pool.availableCount());
    }
}
