package com.virtualtrolley.events;

import java.time.Instant;

/** Immutable fact published by the simulation. Safe to share across threads. */
public record SimulationEvent(EventType type, String actor, String message, Instant at) {
}
