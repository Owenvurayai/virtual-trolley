package com.virtualtrolley.simulation.pool;

import com.virtualtrolley.domain.model.Trolley;
import com.virtualtrolley.domain.model.TrolleyState;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * Object Pool of trolleys. A trolley taken from the queue is invisible to every
 * other thread until it is released, so it cannot be double-booked.
 */
public final class TrolleyPool {

    private final BlockingQueue<Trolley> available = new LinkedBlockingQueue<>();
    private final int size;

    public TrolleyPool(int size) {
        this.size = size;
        for (int i = 1; i <= size; i++) {
            available.add(new Trolley(i, "TRL-%04d".formatted(i)));
        }
    }

    /** Blocks until a trolley is free, then locks it to the customer. */
    public Trolley acquire(String customerId) throws InterruptedException {
        Trolley trolley = available.take();
        try {
            trolley.assignTo(customerId);
            return trolley;
        } catch (RuntimeException e) {
            available.add(trolley); // never lose a trolley on a failed hand-over
            throw e;
        }
    }

    /** Resets the trolley if needed and returns it to circulation. Call from a finally block. */
    public void release(Trolley trolley) {
        if (trolley.state() != TrolleyState.AVAILABLE) {
            trolley.reset();
        }
        available.add(trolley);
    }

    public int availableCount() {
        return available.size();
    }

    public int size() {
        return size;
    }
}
