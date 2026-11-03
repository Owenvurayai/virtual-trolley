package com.virtualtrolley.events;

/**
 * Wire format of an event. 'seq' is strictly increasing, so a client that
 * loads a state snapshot can discard any streamed event with seq <= snapshot.lastSeq.
 */
public record SequencedEvent(long seq, EventType type, String actor, String message, long at) {
}
