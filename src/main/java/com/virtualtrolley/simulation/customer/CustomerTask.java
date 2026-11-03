package com.virtualtrolley.simulation.customer;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.domain.model.CartLine;
import com.virtualtrolley.domain.model.Product;
import com.virtualtrolley.domain.model.Receipt;
import com.virtualtrolley.domain.model.Trolley;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.events.EventType;
import com.virtualtrolley.payment.PaymentFailedException;
import com.virtualtrolley.simulation.cashier.CheckoutQueue;
import com.virtualtrolley.simulation.cashier.CheckoutRequest;
import com.virtualtrolley.simulation.control.PauseGate;
import com.virtualtrolley.simulation.pool.TrolleyPool;
import com.virtualtrolley.store.Inventory;
import com.virtualtrolley.store.ProductCatalog;
import com.virtualtrolley.util.Delays;
import com.virtualtrolley.util.Formats;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Producer: one shopping trip. Take a trolley, shop, queue at the till, pay, return the trolley.
 *
 * The trolley is leased: whatever happens after acquire(), the finally block
 * returns it, so a failing customer can never shrink the pool.
 */
public final class CustomerTask implements Callable<CustomerOutcome> {

    private final String id;
    private final SimulationConfig config;
    private final ProductCatalog catalog;
    private final Inventory inventory;
    private final TrolleyPool pool;
    private final CheckoutQueue checkoutQueue;
    private final ShoppingStrategy strategy;
    private final EventBus bus;
    private final PauseGate gate;
    private final Random random;
    private boolean paid; // confined to this task's thread, so no synchronisation needed

    public CustomerTask(int number, SimulationConfig config, ProductCatalog catalog, Inventory inventory,
                        TrolleyPool pool, CheckoutQueue checkoutQueue, ShoppingStrategy strategy,
                        EventBus bus, PauseGate gate) {
        this.id = "customer-" + number;
        this.config = config;
        this.catalog = catalog;
        this.inventory = inventory;
        this.pool = pool;
        this.checkoutQueue = checkoutQueue;
        this.strategy = strategy;
        this.bus = bus;
        this.gate = gate;
        this.random = new Random(config.seed() + number); // per-customer seed => reproducible lists
    }

    @Override
    public CustomerOutcome call() throws InterruptedException {
        Trolley trolley = pool.acquire(id); // blocks until a trolley is free
        try {
            bus.publish(EventType.TROLLEY_TAKEN, id,
                    "Took trolley #%d (%s), now locked".formatted(trolley.id(), trolley.barcode()));
            shop(trolley);
            return checkout(trolley);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return CustomerOutcome.ABANDONED;
        } finally {
            // Lease: the trolley always goes back; unpaid goods go back on the shelves
            if (!paid) {
                returnGoodsToShelves(trolley);
            }
            pool.release(trolley);
            bus.publish(EventType.TROLLEY_RESET, id, "Trolley #%d reset and returned".formatted(trolley.id()));
        }
    }

    // ---------- steps ----------

    private void shop(Trolley trolley) throws InterruptedException {
        List<Product> added = new ArrayList<>();
        for (Product product : strategy.chooseItems(catalog, random)) {
            gate.awaitOpen();                                  // pause point
            Delays.sleepUpTo(random, config.maxShopDelayMs()); // walking to the shelf
            if (inventory.tryTake(product.id())) {             // atomic: only one customer gets the last unit
                trolley.add(id, product);
                added.add(product);
                bus.publish(EventType.ITEM_ADDED, id, "+ %-22s %9s | trolley %s, %s".formatted(
                        product.name(), Formats.money(product.priceCents()),
                        Formats.money(trolley.totalCents()), Formats.kg(trolley.totalGrams())));
            } else {
                bus.publish(EventType.OUT_OF_STOCK, id, "Sold out: " + product.name());
            }
        }
        // Occasionally change their mind about the last item
        if (!added.isEmpty() && random.nextDouble() < 0.3) {
            Product putBack = added.get(added.size() - 1);
            if (trolley.remove(id, putBack)) {
                inventory.restock(putBack.id(), 1);
                bus.publish(EventType.ITEM_REMOVED, id, "- %-22s %9s | trolley %s, %s".formatted(
                        putBack.name(), Formats.money(putBack.priceCents()),
                        Formats.money(trolley.totalCents()), Formats.kg(trolley.totalGrams())));
            }
        }
    }

    private CustomerOutcome checkout(Trolley trolley) throws InterruptedException {
        gate.awaitOpen(); // pause point
        trolley.proceedToCheckout(id);
        CheckoutRequest request = new CheckoutRequest(id, trolley, new CompletableFuture<>());
        bus.publish(EventType.CUSTOMER_AT_TILL, id, "Joined the checkout line (%d ahead)"
                .formatted(checkoutQueue.waiting()));
        checkoutQueue.submit(request);
        try {
            // Bounded wait: a stuck till must not hang the customer forever
            Receipt receipt = request.result().get(config.checkoutTimeoutMs(), TimeUnit.MILLISECONDS);
            paid = receipt != null;
            return CustomerOutcome.PAID;
        } catch (ExecutionException e) {
            if (e.getCause() instanceof PaymentFailedException) {
                return CustomerOutcome.PAYMENT_FAILED;
            }
            bus.publish(EventType.ERROR, id, "Checkout failed: " + e.getCause());
            return CustomerOutcome.ABANDONED;
        } catch (TimeoutException e) {
            bus.publish(EventType.ERROR, id, "Gave up waiting at the till");
            return CustomerOutcome.ABANDONED;
        }
    }

    // ---------- helpers ----------

    private void returnGoodsToShelves(Trolley trolley) {
        for (CartLine line : trolley.snapshot().lines()) {
            inventory.restock(line.product().id(), line.quantity());
        }
    }
}
