package com.virtualtrolley.simulation.control;

import com.virtualtrolley.config.SimulationConfig;
import com.virtualtrolley.config.SimulationProperties;
import com.virtualtrolley.events.EventBus;
import com.virtualtrolley.events.EventStreamService;
import com.virtualtrolley.events.EventType;
import com.virtualtrolley.events.SimulationEvent;
import com.virtualtrolley.payment.CardPayment;
import com.virtualtrolley.simulation.batch.BatchController;
import com.virtualtrolley.stats.SimulationSummary;
import com.virtualtrolley.store.ProductCatalog;
import com.virtualtrolley.store.StockEntry;
import com.virtualtrolley.util.Formats;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Application-level control of the simulation (start / pause / resume / reset).
 *
 * Command pattern: every command runs on ONE control thread, so a user hammering
 * the buttons can never interleave two commands. The simulation itself runs on a
 * separate runner thread; reset cancels it by interrupting that thread.
 */
@Service
public class SimulationService {

    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);

    /** One run of the simulation and the handles needed to control it. */
    private static final class Run {
        final long id;
        final BatchController controller;
        final PauseGate gate;
        volatile Future<?> task;

        Run(long id, BatchController controller, PauseGate gate) {
            this.id = id;
            this.controller = controller;
            this.gate = gate;
        }
    }

    private final SimulationProperties properties;
    private final ProductCatalog catalog;
    private final EventStreamService stream;

    private final ExecutorService control = Executors.newSingleThreadExecutor(daemon("sim-control"));
    private final ExecutorService runner = Executors.newSingleThreadExecutor(daemon("sim-runner"));

    // Written only on the control thread, read from request threads
    private volatile SimulationStatus status = SimulationStatus.IDLE;
    private volatile Run current;
    private long lastRunId; // control thread only

    public SimulationService(SimulationProperties properties, ProductCatalog catalog,
                             EventStreamService stream) {
        this.properties = properties;
        this.catalog = catalog;
        this.stream = stream;
    }

    // ---------- public commands ----------

    public SimulationStatus start() {
        return onControlThread(this::doStart);
    }

    public SimulationStatus pause() {
        return onControlThread(this::doPause);
    }

    public SimulationStatus resume() {
        return onControlThread(this::doResume);
    }

    public SimulationStatus reset() {
        return onControlThread(this::doReset);
    }

    // ---------- query ----------

    public SimulationSnapshot snapshot() {
        Run run = current;
        EventStreamService.Snapshot history = stream.snapshot();

        if (run == null) { // idle: empty shop, full shelves
            List<SimulationSnapshot.StockView> shelves = catalog.entries().stream()
                    .map(e -> new SimulationSnapshot.StockView(e.product().id(), e.initialStock()))
                    .toList();
            return new SimulationSnapshot(status, history.lastSeq(), List.of(), shelves,
                    new SimulationSnapshot.StatsView(0, 0, 0), history.events());
        }

        BatchController controller = run.controller;
        List<SimulationSnapshot.TrolleyView> trolleys = controller.trolleyPool().all().stream()
                .map(SimulationSnapshot.TrolleyView::of).toList();
        List<SimulationSnapshot.StockView> shelves = catalog.entries().stream()
                .map(StockEntry::product)
                .map(p -> new SimulationSnapshot.StockView(p.id(), controller.inventory().available(p.id())))
                .toList();
        var stats = new SimulationSnapshot.StatsView(controller.stats().revenueCents(),
                controller.stats().salesCount(), controller.queueLength());
        return new SimulationSnapshot(status, history.lastSeq(), trolleys, shelves, stats, history.events());
    }

    // ---------- command implementations (control thread only) ----------

    private SimulationStatus doStart() {
        if (status == SimulationStatus.RUNNING || status == SimulationStatus.PAUSED) {
            throw new InvalidCommandException("Simulation is already " + status);
        }
        SimulationConfig config = properties.toConfig();
        long runId = ++lastRunId;
        PauseGate gate = new PauseGate();

        // A fresh bus per run: late events from an old run can never leak into a new one
        EventBus bus = new EventBus();
        bus.subscribe(event -> forwardIfCurrent(runId, event));

        BatchController controller = new BatchController(config, catalog,
                new CardPayment(config.paymentFailureRate(), config.seed()), bus, gate);
        Run run = new Run(runId, controller, gate);

        stream.clearHistory();
        current = run;
        status = SimulationStatus.RUNNING;
        publishSystem(EventType.SIMULATION_STARTED, "Simulation started");
        run.task = runner.submit(() -> execute(run));
        return status;
    }

    private SimulationStatus doPause() {
        require(SimulationStatus.RUNNING, "pause");
        current.gate.pause();
        status = SimulationStatus.PAUSED;
        publishSystem(EventType.SIMULATION_PAUSED, "Simulation paused");
        return status;
    }

    private SimulationStatus doResume() {
        require(SimulationStatus.PAUSED, "resume");
        current.gate.resume();
        status = SimulationStatus.RUNNING;
        publishSystem(EventType.SIMULATION_RESUMED, "Simulation resumed");
        return status;
    }

    private SimulationStatus doReset() {
        Run run = current;
        if (run != null) {
            run.gate.resume();           // wake anything parked at the gate
            Future<?> task = run.task;
            if (task != null) {
                task.cancel(true);       // interrupt: BatchController unwinds and frees every trolley
            }
        }
        current = null;                  // from here the old run's events are ignored
        status = SimulationStatus.IDLE;
        stream.clearHistory();
        publishSystem(EventType.SIMULATION_RESET, "Simulation reset");
        return status;
    }

    // ---------- runner thread ----------

    private void execute(Run run) {
        try {
            SimulationSummary summary = run.controller.run();
            control.submit(() -> finish(run, summary));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // cancelled by reset: nothing more to report
        } catch (RuntimeException e) {
            log.error("Simulation run {} failed", run.id, e);
            control.submit(() -> fail(run, e));
        }
    }

    private void finish(Run run, SimulationSummary summary) {
        if (current != run) {
            return; // reset while finishing
        }
        status = SimulationStatus.FINISHED;
        publishSystem(EventType.SIMULATION_FINISHED, "Finished: %d paid, %d declined, %d abandoned, revenue %s"
                .formatted(summary.paid(), summary.paymentFailed(), summary.abandoned(),
                        Formats.money(summary.revenueCents())));
    }

    private void fail(Run run, RuntimeException error) {
        if (current != run) {
            return;
        }
        status = SimulationStatus.FINISHED;
        publishSystem(EventType.ERROR, "Simulation failed: " + error);
    }

    // ---------- helpers ----------

    private void forwardIfCurrent(long runId, SimulationEvent event) {
        Run run = current;
        if (run != null && run.id == runId) {
            stream.record(event);
        }
    }

    private void publishSystem(EventType type, String message) {
        stream.record(new SimulationEvent(type, "system", message, Instant.now()));
    }

    private void require(SimulationStatus expected, String action) {
        if (status != expected) {
            throw new InvalidCommandException("Cannot %s while %s".formatted(action, status));
        }
    }

    /** Runs a command on the single control thread and waits for its result. */
    private SimulationStatus onControlThread(Callable<SimulationStatus> command) {
        try {
            return control.submit(command).get();
        } catch (ExecutionException e) {
            if (e.getCause() instanceof RuntimeException re) {
                throw re; // InvalidCommandException reaches the controller unchanged
            }
            throw new IllegalStateException(e.getCause());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for command", e);
        }
    }

    @PreDestroy
    void shutdown() {
        control.shutdownNow();
        runner.shutdownNow(); // interrupts a running simulation so the JVM can exit
    }

    private static java.util.concurrent.ThreadFactory daemon(String name) {
        return runnable -> {
            Thread thread = new Thread(runnable, name);
            thread.setDaemon(true);
            return thread;
        };
    }
}
