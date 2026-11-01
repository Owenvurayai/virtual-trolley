package com.virtualtrolley.simulation.cashier;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.domain.model.CartLine;
import com.virtualtrolley.domain.model.CartSnapshot;
import com.virtualtrolley.domain.model.Receipt;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.events.EventType;
import com.virtualtrolley.payment.PaymentFailedException;
import com.virtualtrolley.payment.PaymentResult;
import com.virtualtrolley.payment.PaymentStrategy;
import com.virtualtrolley.stats.SimulationStats;
import com.virtualtrolley.util.Delays;
import com.virtualtrolley.util.Formats;

import java.time.Instant;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/** Consumer: serves customers one at a time until it receives a poison pill. */
public final class CashierTask implements Runnable {

    private final String name;
    private final CheckoutQueue queue;
    private final PaymentStrategy payment;
    private final EventBus bus;
    private final SimulationStats stats;
    private final SimulationConfig config;
    private final AtomicLong receiptSequence; // shared so receipt numbers are unique across cashiers
    private final Random random;

    public CashierTask(String name, CheckoutQueue queue, PaymentStrategy payment, EventBus bus,
                       SimulationStats stats, SimulationConfig config, AtomicLong receiptSequence) {
        this.name = name;
        this.queue = queue;
        this.payment = payment;
        this.bus = bus;
        this.stats = stats;
        this.config = config;
        this.receiptSequence = receiptSequence;
        this.random = new Random(config.seed() ^ name.hashCode());
    }

    @Override
    public void run() {
        try {
            while (true) {
                CheckoutRequest request = queue.next(); // parks here while the line is empty
                if (request.isPoisonPill()) {
                    break;
                }
                serve(request);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // preserve the flag for the executor
        }
        bus.publish(EventType.CASHIER_CLOSED, name, "Till closed");
    }

    private void serve(CheckoutRequest request) throws InterruptedException {
        try {
            // Scan the trolley barcode: the whole basket appears, no unpacking needed
            CartSnapshot cart = request.trolley().beginScan();
            bus.publish(EventType.CART_SCANNED, name, cartScreen(request.customerId(), cart));

            Delays.sleepUpTo(random, config.maxCashierDelayMs()); // time to take payment

            PaymentResult result = payment.pay(cart, request.customerId());
            if (result.approved()) {
                Receipt receipt = new Receipt(receiptSequence.incrementAndGet(), request.customerId(),
                        name, cart, result.method(), Instant.now());
                stats.recordSale(receipt.totalCents());
                bus.publish(EventType.PAYMENT_OK, name, request.customerId() + " paid "
                        + Formats.money(receipt.totalCents()) + " by " + result.method());
                bus.publish(EventType.RECEIPT_PRINTED, name, receiptText(receipt));
                request.result().complete(receipt);
            } else {
                bus.publish(EventType.PAYMENT_FAILED, name,
                        request.customerId() + ": " + result.reason());
                request.result().completeExceptionally(new PaymentFailedException(result.reason()));
            }
        } catch (InterruptedException e) {
            request.result().completeExceptionally(e); // never leave a customer waiting forever
            throw e;
        } catch (RuntimeException e) {
            // One bad customer must not take the till down
            request.result().completeExceptionally(e);
            bus.publish(EventType.ERROR, name, "Failed serving " + request.customerId() + ": " + e);
        }
    }

    /** What the cashier's screen shows after the scan. */
    private static String cartScreen(String customerId, CartSnapshot cart) {
        return "Scanned %s (%s) | %d items | %s | %s%n%s".formatted(
                cart.barcode(), customerId, cart.itemCount(), Formats.money(cart.totalCents()),
                Formats.kg(cart.totalGrams()), lines(cart));
    }

    private static String receiptText(Receipt r) {
        return "RECEIPT #%05d | %s | %s%n%s%n    TOTAL %s".formatted(
                r.number(), r.customerId(), r.paymentMethod(), lines(r.cart()),
                Formats.money(r.totalCents()));
    }

    private static String lines(CartSnapshot cart) {
        return cart.lines().stream()
                .map(CashierTask::line)
                .collect(Collectors.joining(System.lineSeparator()));
    }

    private static String line(CartLine l) {
        return "    %2d x %-22s %10s".formatted(l.quantity(), l.product().name(),
                Formats.money(l.lineTotalCents()));
    }
}
