package com.virtualtrolley.events;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Consumer;

/** Prints events as "[ elapsed ] actor message". One println per event keeps lines from interleaving. */
public final class ConsoleEventPrinter implements Consumer<SimulationEvent> {

    private final Instant start = Instant.now();

    @Override
    public void accept(SimulationEvent event) {
        long elapsedMs = Duration.between(start, event.at()).toMillis();
        System.out.println(String.format("[%6d ms] %-12s %s", elapsedMs, event.actor(), event.message()));
    }
}
