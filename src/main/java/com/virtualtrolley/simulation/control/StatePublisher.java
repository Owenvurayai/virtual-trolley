package com.virtualtrolley.simulation.control;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Pushes the live numbers (trolleys, stock, stats) to the browser twice a second while a run is
 * active, and once more whenever the status changes. Idle or finished simulations cost nothing.
 */
@Service
public class StatePublisher {

    private final SimulationService service;
    private final StateSender sender;
    private SimulationStatus lastSent; // touched only by the scheduler thread

    public StatePublisher(SimulationService service, StateSender sender) {
        this.service = service;
        this.sender = sender;
    }

    @Scheduled(fixedRate = 500)
    public void publish() {
        SimulationStatus status = service.status();
        boolean active = status == SimulationStatus.RUNNING || status == SimulationStatus.PAUSED;
        if (!active && status == lastSent) {
            return; // nothing is changing
        }
        lastSent = status;
        sender.send(service.state());
    }
}
