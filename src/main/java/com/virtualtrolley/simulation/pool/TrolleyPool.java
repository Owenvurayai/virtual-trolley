package com.virtualtrolley.simulation.pool;

import com.virtualtrolley.domain.model.Trolley;
import com.virtualtrolley.domain.model.TrolleyState;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * Object Pool of trolleys. A trolley taken from the queue is invisible to every
 * other thread until it is released, so it cannot be double-booked.
 */
public final class TrolleyPool {

    private final BlockingQueue<Trolley> available = new LinkedBlockingQueue<>();
    private final List<Trolley> all; // every trolley, in or out of circulation (for snapshots)
    private final int size;

    public TrolleyPool(int size) {
        this.size = size;
        List<Trolley> trolleys = new ArrayList<>(size);
        for (int i = 1; i <= size; i++) {
            Trolley trolley = new Trolley(i, "TRL-%04d".formatted(i));
            trolleys.add(trolley);
            available.add(trolley);
        }
        this.all = List.copyOf(trolleys);
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

    public List<Trolley> all() {
        return all;
    }

    public int availableCount() {
        return available.size();
    }

    public int size() {
        return size;
    }
}
