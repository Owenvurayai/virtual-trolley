package com.virtualtrolley.simulation;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.payment.CardPayment;
import com.virtualtrolley.simulation.batch.BatchController;
import com.virtualtrolley.stats.SimulationSummary;
import com.virtualtrolley.store.ProductCatalog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import static org.junit.jupiter.api.Assertions.*;

/** End-to-end run with delays disabled. */
class SimulationRunTest {

    private BatchController controllerWith(SimulationConfig config) {
        return new BatchController(config, ProductCatalog.demo(),
                new CardPayment(config.paymentFailureRate(), config.seed()), new EventBus());
    }

    @Test
    @Timeout(20) // a deadlock fails the test instead of hanging the build
    void everyCustomerIsAccountedForAndAllTrolleysReturn() throws Exception {
        BatchController controller = controllerWith(SimulationConfig.defaults().withoutDelays());

        SimulationSummary summary = controller.run();

        assertEquals(10, summary.totalCustomers());
        assertEquals(controller.trolleyPool().size(), controller.trolleyPool().availableCount());
    }

    @Test
    @Timeout(20)
    void revenueMatchesNumberOfSuccessfulSales() throws Exception {
        BatchController controller = controllerWith(SimulationConfig.defaults().withoutDelays());

        SimulationSummary summary = controller.run();

        assertEquals(summary.paid(), controller.stats().salesCount());
        assertEquals(controller.stats().revenueCents(), summary.revenueCents());
    }

    @Test
    @Timeout(20)
    void stockIsNeverNegativeAfterARun() throws Exception {
        BatchController controller = controllerWith(SimulationConfig.defaults().withoutDelays());
        controller.run();

        for (var product : ProductCatalog.demo().products()) {
            assertTrue(controller.inventory().available(product.id()) >= 0);
        }
    }

    @Test
    @Timeout(20)
    void declinedPaymentsReturnGoodsToTheShelves() throws Exception {
        // 100% declines: nothing is sold, so every shelf must be back at opening stock
        SimulationConfig allDeclined = new SimulationConfig(7L, 10, 5, 5, 2, 3, 6, 0, 0, 1.0, 30_000);
        BatchController controller = controllerWith(allDeclined);

        SimulationSummary summary = controller.run();

        assertEquals(10, summary.paymentFailed());
        assertEquals(0, summary.revenueCents());
        var fresh = ProductCatalog.demo().newInventory();
        for (var product : ProductCatalog.demo().products()) {
            assertEquals(fresh.available(product.id()), controller.inventory().available(product.id()));
        }
    }
}
