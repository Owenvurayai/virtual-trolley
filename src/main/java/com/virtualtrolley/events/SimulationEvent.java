package com.virtualtrolley.events;

import java.time.Instant;
import java.util.Map;

/**
 * Immutable fact published by the simulation. Safe to share across threads.
 * 'data' carries structured details (product id, totals, ...) so the UI never has to parse 'message'.
 */
public record SimulationEvent(EventType type, String actor, String message, Instant at,
                              Map<String, Object> data) {

    public SimulationEvent {
        data = Map.copyOf(data);
    }

    public SimulationEvent(EventType type, String actor, String message, Instant at) {
        this(type, actor, message, at, Map.of());
    }
}
