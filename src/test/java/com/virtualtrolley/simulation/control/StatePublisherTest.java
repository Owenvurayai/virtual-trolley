package com.virtualtrolley.simulation.control;

import com.virtualtrolley.config.SimulationProperties;
import com.virtualtrolley.events.EventStreamService;
import com.virtualtrolley.store.ProductCatalog;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StatePublisherTest {

    private final List<SimulationSnapshot> sent = new ArrayList<>();
    private SimulationService service;
    private StatePublisher publisher;

    @BeforeEach
    void setUp() {
        // Real delays so the run is still active while we poke it
        SimulationProperties props = new SimulationProperties(1, 10, 5, 5, 2, 3, 6, 300, 300, 0.0, 60_000);
        service = new SimulationService(props, ProductCatalog.demo(), new EventStreamService(batch -> { }));
        publisher = new StatePublisher(service, sent::add);
    }

    @AfterEach
    void tearDown() {
        service.shutdown();
    }

    @Test
    void sendsTheIdleStateOnceThenStaysQuiet() {
        publisher.publish();
        publisher.publish();
        publisher.publish();

        assertEquals(1, sent.size());
        assertEquals(SimulationStatus.IDLE, sent.get(0).status());
    }

    @Test
    void keepsSendingWhileRunning() {
        service.start();

        publisher.publish();
        publisher.publish();
        publisher.publish();

        assertEquals(3, sent.size());
        assertEquals(5, sent.get(2).trolleys().size());
    }

    @Test
    void sendsOnceMoreWhenTheStatusChangesBackToIdle() {
        service.start();
        publisher.publish();
        service.reset();

        publisher.publish();
        publisher.publish();

        assertEquals(2, sent.size()); // one while running, one for IDLE, then quiet
        assertEquals(SimulationStatus.IDLE, sent.get(1).status());
    }

    @Test
    void broadcastsCarryNoEventHistory() {
        service.start();

        publisher.publish();

        assertTrue(sent.get(0).recentEvents().isEmpty(), "history is fetched once over REST, not rebroadcast");
    }
}
