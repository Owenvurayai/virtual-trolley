package com.virtualtrolley.simulation;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.payment.CardPayment;
import com.virtualtrolley.simulation.batch.BatchController;
import com.virtualtrolley.simulation.control.PauseGate;
import com.virtualtrolley.stats.SimulationSummary;
import com.virtualtrolley.store.ProductCatalog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/** Pause, resume and cancellation as the API layer will use them. Real (short) delays are needed here. */
class BatchControllerControlTest {

    // 10 customers, 5 per batch, 30 ms steps: long enough to interrupt, short enough for CI
    private static final SimulationConfig SLOW = new SimulationConfig(1L, 10, 5, 5, 2, 3, 6, 30, 30, 0.0, 30_000);

    private final AtomicInteger eventCount = new AtomicInteger();

    private BatchController controller(PauseGate gate) {
        EventBus bus = new EventBus();
        bus.subscribe(e -> eventCount.incrementAndGet());
        return new BatchController(SLOW, ProductCatalog.demo(), new CardPayment(0.0, 1L), bus, gate);
    }

    @Test
    @Timeout(30)
    void pauseHaltsProgressAndResumeFinishesTheRun() throws Exception {
        PauseGate gate = new PauseGate();
        BatchController controller = controller(gate);
        ExecutorService exec = Executors.newSingleThreadExecutor();
        Future<SimulationSummary> run = exec.submit(controller::run);

        Thread.sleep(100);
        gate.pause();
        Thread.sleep(300);                       // let in-flight steps drain
        int atPause = eventCount.get();
        Thread.sleep(400);
        assertEquals(atPause, eventCount.get(), "no new events while paused");
        assertFalse(run.isDone());

        gate.resume();
        SimulationSummary summary = run.get(20, TimeUnit.SECONDS);
        assertEquals(10, summary.totalCustomers());
        exec.shutdown();
    }

    @Test
    @Timeout(30)
    void cancellingARunFreesEveryTrolley() throws Exception {
        PauseGate gate = new PauseGate();
        BatchController controller = controller(gate);
        ExecutorService exec = Executors.newSingleThreadExecutor();
        AtomicBoolean wasInterrupted = new AtomicBoolean();
        Future<?> run = exec.submit(() -> {
            try {
                controller.run();
            } catch (InterruptedException e) {
                wasInterrupted.set(true);
            }
        });

        Thread.sleep(150);   // customers are mid-shop and holding trolleys
        run.cancel(true);    // what SimulationService.reset() does
        exec.shutdown();
        assertTrue(exec.awaitTermination(15, TimeUnit.SECONDS), "runner must unwind");

        assertTrue(wasInterrupted.get());
        assertEquals(controller.trolleyPool().size(), controller.trolleyPool().availableCount(),
                "every trolley back in the pool after cancel");
    }

    @Test
    @Timeout(30)
    void cancellingWhilePausedStillUnwinds() throws Exception {
        PauseGate gate = new PauseGate();
        BatchController controller = controller(gate);
        ExecutorService exec = Executors.newSingleThreadExecutor();
        Future<?> run = exec.submit(() -> {
            try {
                controller.run();
            } catch (InterruptedException ignored) {
                // expected
            }
        });

        Thread.sleep(100);
        gate.pause();
        Thread.sleep(300);   // workers are now parked at the gate
        run.cancel(true);
        exec.shutdown();

        assertTrue(exec.awaitTermination(15, TimeUnit.SECONDS));
        assertEquals(controller.trolleyPool().size(), controller.trolleyPool().availableCount());
    }
}
