package com.virtualtrolley.events;

import java.time.Clock;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * Minimal publish/subscribe hub (Observer). The simulation publishes,
 * the console printer (now) and WebSocket (later) subscribe.
 * Never call publish() while holding a lock.
 */
public final class EventBus {

    private final List<Consumer<SimulationEvent>> subscribers = new CopyOnWriteArrayList<>();
    private final Clock clock;

    public EventBus() {
        this(Clock.systemUTC());
    }

    /** Injectable clock keeps timestamps deterministic in tests. */
    public EventBus(Clock clock) {
        this.clock = clock;
    }

    public void subscribe(Consumer<SimulationEvent> subscriber) {
        subscribers.add(subscriber);
    }

    public void publish(EventType type, String actor, String message) {
        SimulationEvent event = new SimulationEvent(type, actor, message, clock.instant());
        for (Consumer<SimulationEvent> subscriber : subscribers) {
            try {
                subscriber.accept(event);
            } catch (RuntimeException e) {
                // A faulty subscriber must never break the simulation
                System.err.println("Event subscriber failed: " + e);
            }
        }
    }
}
