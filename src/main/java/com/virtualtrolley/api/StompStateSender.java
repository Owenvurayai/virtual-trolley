package com.virtualtrolley.api;

import com.virtualtrolley.simulation.control.SimulationSnapshot;
import com.virtualtrolley.simulation.control.StateSender;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/** Adapter: publishes state snapshots to every subscriber of /topic/state. */
@Component
class StompStateSender implements StateSender {

    private final SimpMessagingTemplate template;

    StompStateSender(SimpMessagingTemplate template) {
        this.template = template;
    }

    @Override
    public void send(SimulationSnapshot state) {
        template.convertAndSend("/topic/state", state);
    }
}
