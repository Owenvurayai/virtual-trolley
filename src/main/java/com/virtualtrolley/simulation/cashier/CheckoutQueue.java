package com.virtualtrolley.simulation.cashier;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

/** Producer-consumer hand-off: customers put, cashiers take. FIFO, so nobody is overtaken. */
public final class CheckoutQueue {

    private final BlockingQueue<CheckoutRequest> queue = new LinkedBlockingQueue<>();

    public void submit(CheckoutRequest request) {
        queue.add(request); // unbounded, so this never blocks or fails
    }

    /** Blocks while the line is empty. */
    public CheckoutRequest next() throws InterruptedException {
        return queue.take();
    }

    /** Queues one poison pill per cashier; they exit after serving everyone ahead of the pills. */
    public void shutdown(int cashierCount) {
        for (int i = 0; i < cashierCount; i++) {
            queue.add(CheckoutRequest.POISON_PILL);
        }
    }

    public int waiting() {
        return queue.size();
    }
}
