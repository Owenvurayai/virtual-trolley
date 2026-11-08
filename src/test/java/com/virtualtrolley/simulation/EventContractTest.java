package com.virtualtrolley.simulation;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.events.EventType;
import com.virtualtrolley.events.SimulationEvent;
import com.virtualtrolley.payment.CardPayment;
import com.virtualtrolley.simulation.batch.BatchController;
import com.virtualtrolley.store.ProductCatalog;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The Angular app draws the map, cashier screens and stats from event.data(), so these
 * tests pin that contract: if a field disappears here, the UI would silently break.
 */
class EventContractTest {

    private final List<SimulationEvent> events = new CopyOnWriteArrayList<>();
    private BatchController controller;

    @BeforeEach
    void runASimulation() throws Exception {
        EventBus bus = new EventBus();
        bus.subscribe(events::add);
        SimulationConfig config = SimulationConfig.defaults().withoutDelays();
        controller = new BatchController(config, ProductCatalog.demo(),
                new CardPayment(config.paymentFailureRate(), config.seed()), bus);
        controller.run();
    }

    private List<SimulationEvent> of(EventType type) {
        return events.stream().filter(e -> e.type() == type).toList();
    }

    @Test
    @Timeout(20)
    void trolleyEventsCarryTheTrolleyId() {
        for (EventType type : List.of(EventType.TROLLEY_TAKEN, EventType.TROLLEY_RESET, EventType.CUSTOMER_AT_TILL)) {
            assertFalse(of(type).isEmpty(), type + " was never published");
            of(type).forEach(e -> assertTrue(e.data().get("trolleyId") instanceof Integer, type + " lacks trolleyId"));
        }
    }

    @Test
    @Timeout(20)
    void everyItemEventCarriesProductAndTrolleyTotals() {
        for (SimulationEvent e : of(EventType.ITEM_ADDED)) {
            Map<String, Object> d = e.data();
            assertTrue(d.get("productId") instanceof Integer);
            assertTrue(d.get("totalCents") instanceof Long);
            assertTrue(d.get("totalGrams") instanceof Long);
            assertTrue((Long) d.get("totalCents") > 0, "an add can never leave the trolley empty");
        }
    }

    @Test
    @Timeout(20)
    void everyWalkIsAnnouncedBeforeTheItemIsAddedOrMissed() {
        long walks = of(EventType.CUSTOMER_WALKING).size();
        long outcomes = of(EventType.ITEM_ADDED).size() + of(EventType.OUT_OF_STOCK).size();

        assertEquals(outcomes, walks);
        of(EventType.CUSTOMER_WALKING).forEach(e -> {
            assertTrue(e.data().get("productId") instanceof Integer);
            assertTrue(e.data().get("etaMs") instanceof Long);
        });
    }

    @Test
    @Timeout(20)
    void scannedCartsListEveryLineAndAgreeWithTheirTotal() {
        assertEquals(10, of(EventType.CART_SCANNED).size());
        for (SimulationEvent e : of(EventType.CART_SCANNED)) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) e.data().get("items");
            long sum = items.stream().mapToLong(i -> (Long) i.get("lineCents")).sum();

            assertEquals(e.data().get("totalCents"), sum, "line totals must add up to the basket total");
            assertNotNull(e.data().get("customerId"));
            assertNotNull(e.data().get("barcode"));
            assertTrue(e.data().get("waitMs") instanceof Long);
        }
    }

    @Test
    @Timeout(20)
    void receiptsAndPaymentsCarryTheirOwnData() {
        of(EventType.RECEIPT_PRINTED).forEach(e -> {
            assertTrue(e.data().get("receiptNumber") instanceof Long);
            assertNotNull(e.data().get("items"));
            assertNotNull(e.data().get("method"));
        });
        of(EventType.PAYMENT_OK).forEach(e -> assertTrue(e.data().get("totalCents") instanceof Long));
        of(EventType.PAYMENT_FAILED).forEach(e -> assertNotNull(e.data().get("reason")));
    }

    @Test
    @Timeout(20)
    void statsCoverEveryCustomerAndBatch() {
        assertEquals(10, controller.stats().queueWaitCount(), "every customer reaches a cashier");
        assertEquals(2, controller.stats().batchesCompleted());
        assertTrue(controller.activeElapsedMs() >= 0);
    }
}
