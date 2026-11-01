package com.virtualtrolley.store;

import com.virtualtrolley.domain.model.Product;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class InventoryTest {

    private static Inventory inventoryWithStock(int stock) {
        return new Inventory(List.of(new StockEntry(new Product(1, "Chicken", 12_999, 2_000), stock)));
    }

    @Test
    void lastItemGoesToExactlyOneThread() throws Exception {
        Inventory inventory = inventoryWithStock(1);
        int contenders = 50;
        ExecutorService pool = Executors.newFixedThreadPool(contenders);
        CountDownLatch startGun = new CountDownLatch(1); // release everyone at the same instant
        AtomicInteger winners = new AtomicInteger();

        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < contenders; i++) {
            futures.add(pool.submit(() -> {
                startGun.await();
                if (inventory.tryTake(1)) {
                    winners.incrementAndGet();
                }
                return null;
            }));
        }
        startGun.countDown();
        for (Future<?> f : futures) {
            f.get(5, TimeUnit.SECONDS);
        }
        pool.shutdown();

        assertEquals(1, winners.get());
        assertEquals(0, inventory.available(1));
    }

    @Test
    void stockNeverGoesNegative() {
        Inventory inventory = inventoryWithStock(2);

        assertTrue(inventory.tryTake(1));
        assertTrue(inventory.tryTake(1));
        assertFalse(inventory.tryTake(1));
        assertEquals(0, inventory.available(1));
    }

    @Test
    void restockMakesItemAvailableAgain() {
        Inventory inventory = inventoryWithStock(0);

        inventory.restock(1, 3);

        assertEquals(3, inventory.available(1));
    }

    @Test
    void unknownProductIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> inventoryWithStock(1).tryTake(99));
    }
}
