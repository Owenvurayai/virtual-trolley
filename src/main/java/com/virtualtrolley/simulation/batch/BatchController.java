package com.virtualtrolley.simulation.batch;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.events.EventType;
import com.virtualtrolley.payment.PaymentStrategy;
import com.virtualtrolley.simulation.cashier.CashierTask;
import com.virtualtrolley.simulation.cashier.CheckoutQueue;
import com.virtualtrolley.simulation.customer.CustomerOutcome;
import com.virtualtrolley.simulation.customer.CustomerTask;
import com.virtualtrolley.simulation.customer.RandomShopper;
import com.virtualtrolley.simulation.pool.TrolleyPool;
import com.virtualtrolley.stats.SimulationStats;
import com.virtualtrolley.stats.SimulationSummary;
import com.virtualtrolley.store.Inventory;
import com.virtualtrolley.store.ProductCatalog;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Orchestrates a run: owns both thread pools and releases customers in batches.
 * Customer pool is sized to the batch, so at most 5 shoppers exist at once;
 * the cashier pool is fixed at 2.
 */
public final class BatchController {

    private static final long SHUTDOWN_WAIT_SECONDS = 10;

    private final SimulationConfig config;
    private final ProductCatalog catalog;
    private final PaymentStrategy payment;
    private final EventBus bus;

    // Shared state created per controller, exposed read-only for tests and the UI later
    private final Inventory inventory;
    private final TrolleyPool trolleyPool;
    private final CheckoutQueue checkoutQueue = new CheckoutQueue();
    private final SimulationStats stats = new SimulationStats();

    public BatchController(SimulationConfig config, ProductCatalog catalog,
                           PaymentStrategy payment, EventBus bus) {
        this.config = config;
        this.catalog = catalog;
        this.payment = payment;
        this.bus = bus;
        this.inventory = catalog.newInventory();
        this.trolleyPool = new TrolleyPool(config.trolleyCount());
    }

    /** Runs every batch to completion, then shuts both pools down cleanly. */
    public SimulationSummary run() throws InterruptedException {
        long startedAt = System.nanoTime();
        ExecutorService customerPool = Executors.newFixedThreadPool(config.batchSize(), named("customer-thread"));
        ExecutorService cashierPool = Executors.newFixedThreadPool(config.cashierCount(), named("cashier-thread"));

        AtomicLong receiptSequence = new AtomicLong();
        for (int i = 1; i <= config.cashierCount(); i++) {
            cashierPool.submit(new CashierTask("cashier-" + i, checkoutQueue, payment, bus,
                    stats, config, receiptSequence));
        }

        int paid = 0, failed = 0, abandoned = 0;
        try {
            int nextCustomer = 1;
            int batchNumber = 0;
            while (nextCustomer <= config.totalCustomers()) {
                int size = Math.min(config.batchSize(), config.totalCustomers() - nextCustomer + 1);
                batchNumber++;
                bus.publish(EventType.BATCH_STARTED, "system",
                        "=== Batch %d: %d customers enter ===".formatted(batchNumber, size));

                List<Callable<CustomerOutcome>> batch = new ArrayList<>(size);
                for (int i = 0; i < size; i++) {
                    batch.add(new CustomerTask(nextCustomer++, config, catalog, inventory, trolleyPool,
                            checkoutQueue, new RandomShopper(config.minItems(), config.maxItems()), bus));
                }

                // invokeAll blocks until every customer in the batch is done: this is the batch barrier
                for (Future<CustomerOutcome> future : customerPool.invokeAll(batch)) {
                    switch (outcomeOf(future)) {
                        case PAID -> paid++;
                        case PAYMENT_FAILED -> failed++;
                        case ABANDONED -> abandoned++;
                    }
                }
                bus.publish(EventType.BATCH_FINISHED, "system", "=== Batch %d complete ===".formatted(batchNumber));
            }
        } finally {
            // Always release threads, even if a batch blew up
            checkoutQueue.shutdown(config.cashierCount());
            customerPool.shutdown();
            cashierPool.shutdown();
            if (!cashierPool.awaitTermination(SHUTDOWN_WAIT_SECONDS, TimeUnit.SECONDS)) {
                cashierPool.shutdownNow();
            }
            if (!customerPool.awaitTermination(SHUTDOWN_WAIT_SECONDS, TimeUnit.SECONDS)) {
                customerPool.shutdownNow();
            }
        }

        long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
        return new SimulationSummary(paid, failed, abandoned, stats.revenueCents(), elapsedMs);
    }

    public TrolleyPool trolleyPool() {
        return trolleyPool;
    }

    public Inventory inventory() {
        return inventory;
    }

    public SimulationStats stats() {
        return stats;
    }

    // ---------- helpers ----------

    /** A customer that threw is counted as abandoned rather than crashing the whole run. */
    private CustomerOutcome outcomeOf(Future<CustomerOutcome> future) throws InterruptedException {
        try {
            return future.get();
        } catch (ExecutionException e) {
            bus.publish(EventType.ERROR, "system", "Customer crashed: " + e.getCause());
            return CustomerOutcome.ABANDONED;
        }
    }

    /** Named threads make thread dumps readable. */
    private static ThreadFactory named(String prefix) {
        AtomicInteger counter = new AtomicInteger();
        return runnable -> new Thread(runnable, prefix + "-" + counter.incrementAndGet());
    }
}
