package com.virtualtrolley;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.events.ConsoleEventPrinter;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.payment.CardPayment;
import com.virtualtrolley.simulation.batch.BatchController;
import com.virtualtrolley.stats.SimulationSummary;
import com.virtualtrolley.store.ProductCatalog;
import com.virtualtrolley.util.Formats;

/** Entry point for the Week 1-2 console simulation. Wiring only, no logic. */
public final class ConsoleSimulationApp {

    private ConsoleSimulationApp() {
    }

    public static void main(String[] args) throws InterruptedException {
        SimulationConfig config = SimulationConfig.defaults();

        EventBus bus = new EventBus();
        bus.subscribe(new ConsoleEventPrinter());

        BatchController controller = new BatchController(
                config,
                ProductCatalog.demo(),
                new CardPayment(config.paymentFailureRate(), config.seed()),
                bus);

        SimulationSummary summary = controller.run();

        System.out.println();
        System.out.println("---------------- SUMMARY ----------------");
        System.out.printf("Customers: %d (paid %d, payment failed %d, abandoned %d)%n",
                summary.totalCustomers(), summary.paid(), summary.paymentFailed(), summary.abandoned());
        System.out.printf("Revenue:   %s%n", Formats.money(summary.revenueCents()));
        System.out.printf("Trolleys back in pool: %d/%d%n",
                controller.trolleyPool().availableCount(), controller.trolleyPool().size());
        System.out.printf("Elapsed:   %d ms%n", summary.elapsedMs());
    }
}
