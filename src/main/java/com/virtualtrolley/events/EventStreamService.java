package com.virtualtrolley.events;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Sits between the simulation and the network.
 *  - assigns sequence numbers,
 *  - keeps a short history so a refreshed browser can catch up,
 *  - throttles: events are sent in one batch every 50 ms instead of one message each.
 */
@Service
public class EventStreamService {

    static final int RECENT_LIMIT = 200;

    /** Consistent view of the history and the last sequence number. */
    public record Snapshot(long lastSeq, List<SequencedEvent> events) {
    }

    private final EventSender sender;

    // --- all guarded by 'this' ---
    private final Deque<SequencedEvent> recent = new ArrayDeque<>();
    private final List<SequencedEvent> pending = new ArrayList<>();
    private long seq;

    public EventStreamService(EventSender sender) {
        this.sender = sender;
    }

    /** Called from simulation threads. Cheap and non-blocking: no network I/O here. */
    public synchronized void record(SimulationEvent event) {
        SequencedEvent wire = new SequencedEvent(++seq, event.type(), event.actor(),
                event.message(), event.at().toEpochMilli(), event.data());
        recent.addLast(wire);
        if (recent.size() > RECENT_LIMIT) {
            recent.removeFirst();
        }
        pending.add(wire);
    }

    public synchronized Snapshot snapshot() {
        return new Snapshot(seq, List.copyOf(recent));
    }

    /** Forget history (new run or reset). Sequence numbers keep rising so clients never see a repeat. */
    public synchronized void clearHistory() {
        recent.clear();
        pending.clear();
    }

    @Scheduled(fixedRate = 50)
    public void flush() {
        List<SequencedEvent> batch;
        synchronized (this) {
            if (pending.isEmpty()) {
                return;
            }
            batch = List.copyOf(pending);
            pending.clear();
        }
        sender.send(batch); // outside the lock: never do network I/O while holding it
    }
}
