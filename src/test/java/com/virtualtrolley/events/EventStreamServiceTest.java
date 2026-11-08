package com.virtualtrolley.events;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;

class EventStreamServiceTest {

    private final List<List<SequencedEvent>> sent = new CopyOnWriteArrayList<>();
    private EventStreamService stream;

    @BeforeEach
    void setUp() {
        stream = new EventStreamService(sent::add);
    }

    private static SimulationEvent event(String message) {
        return new SimulationEvent(EventType.ITEM_ADDED, "customer-1", message, Instant.now());
    }

    @Test
    void eventsAreBatchedIntoOneMessagePerFlush() {
        stream.record(event("a"));
        stream.record(event("b"));
        stream.record(event("c"));

        stream.flush();

        assertEquals(1, sent.size());
        assertEquals(List.of(1L, 2L, 3L), sent.get(0).stream().map(SequencedEvent::seq).toList());
    }

    @Test
    void flushWithNothingPendingSendsNothing() {
        stream.flush();

        assertTrue(sent.isEmpty());
    }

    @Test
    void historyIsBoundedButSequenceKeepsCounting() {
        for (int i = 0; i < 250; i++) {
            stream.record(event("e" + i));
        }

        var snapshot = stream.snapshot();

        assertEquals(EventStreamService.RECENT_LIMIT, snapshot.events().size());
        assertEquals(250, snapshot.lastSeq());
        assertEquals(51, snapshot.events().get(0).seq()); // oldest 50 were dropped
    }

    @Test
    void clearingHistoryNeverReusesSequenceNumbers() {
        stream.record(event("a"));
        stream.clearHistory();
        stream.record(event("b"));

        assertEquals(2, stream.snapshot().lastSeq());
        assertEquals(1, stream.snapshot().events().size());
    }

    @Test
    void structuredDataSurvivesTheTripToTheWire() {
        stream.record(new SimulationEvent(EventType.ITEM_ADDED, "customer-1", "m", Instant.now(),
                java.util.Map.of("productId", 3, "totalCents", 12_999L)));

        stream.flush();

        var data = sent.get(0).get(0).data();
        assertEquals(3, data.get("productId"));
        assertEquals(12_999L, data.get("totalCents"));
    }

    @Test
    void eventsWithoutDataGetAnEmptyMapNotNull() {
        stream.record(event("plain"));

        stream.flush();

        assertTrue(sent.get(0).get(0).data().isEmpty());
    }
}
