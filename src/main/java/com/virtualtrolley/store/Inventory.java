package com.virtualtrolley.store;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Shelf stock, shared by every customer thread.
 * Lock-free: each product has an AtomicInteger decremented with a CAS loop,
 * so two customers can never take the last unit.
 */
public final class Inventory {

    private final Map<Integer, AtomicInteger> stock = new ConcurrentHashMap<>();

    public Inventory(List<StockEntry> entries) {
        for (StockEntry e : entries) {
            stock.put(e.product().id(), new AtomicInteger(e.initialStock()));
        }
    }

    /** Atomically takes one unit off the shelf. Returns false if sold out. */
    public boolean tryTake(int productId) {
        AtomicInteger counter = counterFor(productId);
        int current;
        do {
            current = counter.get();
            if (current == 0) {
                return false;
            }
        } while (!counter.compareAndSet(current, current - 1)); // retry if another thread won the race
        return true;
    }

    /** Puts units back (customer put an item back, or the sale failed). */
    public void restock(int productId, int quantity) {
        counterFor(productId).addAndGet(quantity);
    }

    public int available(int productId) {
        return counterFor(productId).get();
    }

    private AtomicInteger counterFor(int productId) {
        AtomicInteger counter = stock.get(productId);
        if (counter == null) {
            throw new IllegalArgumentException("Unknown product id " + productId);
        }
        return counter;
    }
}
